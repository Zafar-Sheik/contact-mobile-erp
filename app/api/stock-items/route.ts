import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { StockItem } from "@/lib/models/StockItem";
import { getSessionClaims } from "@/lib/auth/session";

// Valid sort fields
const VALID_SORT_FIELDS = ["name", "sku", "createdAt", "updatedAt"] as const;
type SortField = (typeof VALID_SORT_FIELDS)[number];

// Valid sort orders
const VALID_SORT_ORDERS = ["asc", "desc"] as const;
type SortOrder = (typeof VALID_SORT_ORDERS)[number];

// Rate limiting store (in-memory - resets on server restart)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // Max 100 requests per minute per user

/**
 * Rate limiter middleware
 * Returns true if request should be blocked
 */
function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitStore.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    // Reset or create new window
    rateLimitStore.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  userLimit.count++;
  return false;
}

/**
 * Sanitize search query to prevent NoSQL injection and XSS
 * Removes potentially dangerous characters
 */
function sanitizeSearchQuery(query: string): string {
  // Remove any characters that could be used for injection
  // Allow alphanumeric, spaces, hyphens, underscores, and common punctuation
  return query
    .replace(/[<>]/g, "") // Remove angle brackets (XSS prevention)
    .replace(/[${}]/g, "") // Remove MongoDB operators
    .replace(/\\/g, "") // Remove backslashes
    .trim()
    .slice(0, 100); // Limit to 100 characters
}

/**
 * Validate and parse pagination parameters
 */
function validatePagination(
  pageParam: string | null,
  limitParam: string | null
): { page: number; limit: number; error?: string } {
  // Parse page (default: 1, minimum: 1)
  const page = pageParam ? parseInt(pageParam, 10) : 1;
  if (isNaN(page) || page < 1) {
    return { page: 0, limit: 0, error: "Invalid page parameter. Must be a positive integer." };
  }

  // Parse limit (default: 100, min: 1, max: 200)
  const requestedLimit = limitParam ? parseInt(limitParam, 10) : 100;
  if (isNaN(requestedLimit) || requestedLimit < 1) {
    return { page: 0, limit: 0, error: "Invalid limit parameter. Must be a positive integer." };
  }

  // Enforce maximum limit of 200
  const limit = Math.min(200, requestedLimit);

  return { page, limit };
}

/**
 * GET /api/stock-items
 *
 * Query params:
 * - page (number, default 1, min 1)
 * - limit (number, default 100, max 200)
 * - q (string, optional search query, max 100 chars)
 * - sortBy (optional: name | sku | createdAt | updatedAt)
 * - sortOrder (asc | desc)
 *
 * Returns:
 * {
 *   items: StockItem[],
 *   totalCount: number,
 *   totalPages: number,
 *   currentPage: number
 * }
 *
 * Rate limit: 100 requests per minute per user
 */
export async function GET(req: Request) {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check rate limit
  if (isRateLimited(session.userId)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(req.url);

  // Validate pagination parameters
  const pageParam = searchParams.get("page");
  const limitParam = searchParams.get("limit");
  const pagination = validatePagination(pageParam, limitParam);

  if (pagination.error) {
    return NextResponse.json({ error: pagination.error }, { status: 400 });
  }

  const { page, limit } = pagination;
  const skip = (page - 1) * limit;

  // Parse and sanitize search query
  const rawSearchQuery = searchParams.get("q");
  const searchQuery = rawSearchQuery ? sanitizeSearchQuery(rawSearchQuery) : "";

  // If query was too long or got sanitized to empty, return error
  if (rawSearchQuery && rawSearchQuery.length > 100) {
    return NextResponse.json(
      { error: "Search query too long. Maximum 100 characters allowed." },
      { status: 400 }
    );
  }

  // Parse and validate sort parameters
  const sortByParam = searchParams.get("sortBy") as SortField | null;
  const sortBy = VALID_SORT_FIELDS.includes(sortByParam as SortField)
    ? sortByParam
    : "name";

  const sortOrderParam = searchParams.get("sortOrder") as SortOrder | null;
  const sortOrder = VALID_SORT_ORDERS.includes(sortOrderParam as SortOrder)
    ? sortOrderParam
    : "asc";

  // Build sort object
  const sort: Record<string, 1 | -1> = {
    [sortBy as string]: sortOrder === "asc" ? 1 : -1,
  };

  // Base filter: company-scoped and not deleted
  const baseFilter = {
    companyId: session.companyId,
    isDeleted: false,
  };

  try {
    let items;
    let totalCount;

    if (searchQuery) {
      // Perform text search across name, sku, description
      // The text index is already defined in the StockItem model:
      // { name: "text", sku: "text", description: "text" }
      const searchFilter = {
        ...baseFilter,
        $text: { $search: searchQuery },
      };

      // When using $text search, add relevance score and sort by it by default
      // unless user explicitly specified a different sort
      const projection = {
        score: { $meta: "textScore" },
      };

      const sortWithRelevance =
        sortBy === "name" && !searchParams.has("sortBy")
          ? { score: { $meta: "textScore" } as const, ...sort }
          : sort;

      [items, totalCount] = await Promise.all([
        StockItem.find(searchFilter)
          .select("-isDeleted -deletedAt")
          .select(projection)
          .sort(sortWithRelevance)
          .skip(skip)
          .limit(limit)
          .lean(),
        StockItem.countDocuments(searchFilter),
      ]);
    } else {
      // No search query - return paginated results sorted by specified field
      [items, totalCount] = await Promise.all([
        StockItem.find(baseFilter)
          .select("-isDeleted -deletedAt")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        StockItem.countDocuments(baseFilter),
      ]);
    }

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      items,
      totalCount,
      totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching stock items:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock items" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check rate limit
  if (isRateLimited(session.userId)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  // Check if SKU already exists for this company
  const existingItem = await StockItem.findOne({
    companyId: session.companyId,
    sku: body.sku,
    isDeleted: false,
  });

  if (existingItem) {
    return NextResponse.json(
      { error: `A stock item with SKU "${body.sku}" already exists. Please use a different SKU or edit the existing item.` },
      { status: 400 }
    );
  }

  try {
    const item = await StockItem.create({
      ...body,
      companyId: session.companyId,
      createdBy: session.userId,
      updatedBy: session.userId,
    });

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json(
        { error: `A stock item with SKU "${body.sku}" already exists.` },
        { status: 400 }
      );
    }
    throw error;
  }
}
