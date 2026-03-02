import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { StockItem } from "@/lib/models/StockItem";
import { StockItemUsage } from "@/lib/models/StockItemUsage";
import { getSessionClaims } from "@/lib/auth/session";
import { Types } from "mongoose";

// Simple in-memory rate limiting (resets on server restart)
// For production, consider Redis or similar
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 30; // max requests
const RATE_WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(sessionId);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(sessionId, { count: 1, resetTime: now + RATE_WINDOW_MS });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
}

interface StockItemSearchResult {
  _id: string;
  sku: string;
  name: string;
  description: string;
  unit: string;
  pricing: {
    costPriceCents: number;
    salePriceCents: number;
  };
}

interface SearchParams {
  q?: string;
  limit?: number;
  cursor?: string;
}

function parseSearchParams(searchParams: SearchParams): { 
  query: string; 
  limit: number; 
  cursor: string | null 
} {
  const q = searchParams.q?.trim() || "";
  
  // Validate query length - reject too-short queries early
  if (q.length === 1) {
    throw new Error("Search query must be at least 2 characters");
  }
  
  // Parse and validate limit
  let limit = 20;
  if (searchParams.limit !== undefined) {
    const parsedLimit = parseInt(String(searchParams.limit), 10);
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      throw new Error("Invalid limit parameter");
    }
    limit = Math.min(parsedLimit, 50); // Cap at 50
  }
  
  // Parse cursor
  const cursor = searchParams.cursor?.trim() || null;
  
  return { query: q, limit, cursor };
}

export async function GET(request: Request) {
  try {
    // Get session to enforce company scoping
    const session = await getSessionClaims();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Rate limiting check
    const sessionId = `${session.companyId}-${session.userId}`;
    if (!checkRateLimit(sessionId)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const params: SearchParams = {
      q: searchParams.get("q") || undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined,
      cursor: searchParams.get("cursor") || undefined,
    };
    
    // Parse and validate params
    let parsedParams;
    try {
      parsedParams = parseSearchParams(params);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid parameters" },
        { status: 400 }
      );
    }
    
    const { query, limit, cursor } = parsedParams;
    const companyId = session.companyId;
    
    // Build query
    const baseQuery: Record<string, unknown> = {
      companyId,
      isDeleted: false,
    };
    
    let items: StockItemSearchResult[];
    let nextCursor: string | null = null;
    
    if (query) {
      // Text search - use MongoDB text search with company filter
      // This uses the text index we created: { name: "text", sku: "text", description: "text" }
      const textQuery = {
        ...baseQuery,
        $text: { $search: query },
      };
      
      // Get one extra to determine if there's a next page
      const textLimit = limit + 1;
      
      items = await StockItem.find(textQuery)
        .select("sku name description unit pricing.costPriceCents pricing.salePriceCents")
        .sort({ score: { $meta: "textScore" }, name: 1 })
        .limit(textLimit)
        .lean() as StockItemSearchResult[];
      
      // Check if there are more results
      if (items.length > limit) {
        items = items.slice(0, limit);
        // Use the last item's _id as cursor
        nextCursor = String(items[items.length - 1]._id);
      }
    } else {
      // No query - return most recently used items first
      // First, get the recently used stock item IDs for this company
      const recentUsage = await StockItemUsage.find({ companyId: new Types.ObjectId(companyId) })
        .sort({ lastUsedAt: -1 })
        .limit(limit)
        .lean();

      let itemsToFetch: Types.ObjectId[] = [];
      
      if (recentUsage.length > 0) {
        // Get the IDs and create a map for sorting
        const usedItemIds = recentUsage.map((r) => r.stockItemId);
        const remainingSlots = limit - usedItemIds.length;
        
        // Get items not in recently used
        const otherItems = await StockItem.find({
          ...baseQuery,
          _id: { $nin: usedItemIds },
        })
          .select("sku name description unit pricing.costPriceCents pricing.salePriceCents")
          .sort({ name: 1 })
          .limit(remainingSlots)
          .lean() as StockItemSearchResult[];
        
        // Combine: recently used first, then others
        const recentItemsData = await StockItem.find({
          _id: { $in: usedItemIds },
        })
          .select("sku name description unit pricing.costPriceCents pricing.salePriceCents")
          .lean() as StockItemSearchResult[];
        
        // Sort by the order in recentUsage
        const idOrder = new Map(usedItemIds.map((id, idx) => [id.toString(), idx]));
        recentItemsData.sort((a, b) => {
          const orderA = idOrder.get(a._id.toString()) ?? Infinity;
          const orderB = idOrder.get(b._id.toString()) ?? Infinity;
          return orderA - orderB;
        });
        
        items = [...recentItemsData, ...otherItems];
      } else {
        // No usage history, just return items sorted by name
        items = await StockItem.find(baseQuery)
          .select("sku name description unit pricing.costPriceCents pricing.salePriceCents")
          .sort({ name: 1 })
          .limit(limit)
          .lean() as StockItemSearchResult[];
      }
      
      // Check if there are more results (for pagination, simplified)
      if (items.length > limit) {
        items = items.slice(0, limit);
      }
    }
    
    // Format response
    const response: { items: StockItemSearchResult[]; nextCursor?: string } = {
      items: items.map((item) => ({
        _id: String(item._id),
        sku: item.sku,
        name: item.name,
        description: item.description || "",
        unit: item.unit,
        pricing: {
          costPriceCents: item.pricing?.costPriceCents || 0,
          salePriceCents: item.pricing?.salePriceCents || 0,
        },
      })),
    };
    
    if (nextCursor) {
      response.nextCursor = nextCursor;
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error("Stock items search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
