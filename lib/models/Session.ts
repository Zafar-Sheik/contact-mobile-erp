import { Schema, model, models } from "mongoose";

const SessionSchema = new Schema(
  {
    // tenant boundary
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // session token (stored directly for simplicity; in production consider hashing)
    sessionToken: { type: String, required: true, unique: true, index: true },

    createdAt: { type: Date, default: Date.now, index: true },
    lastSeenAt: { type: Date, default: Date.now, index: true },

    expiresAt: { type: Date, required: true },

    revokedAt: { type: Date, default: null, index: true },
    revokeReason: { type: String, default: "", maxlength: 200 },

    ipAddress: { type: String, default: "", maxlength: 100 },
    userAgent: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: false, minimize: false },
);

// TTL: MongoDB deletes expired sessions automatically
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

SessionSchema.index({ companyId: 1, userId: 1, revokedAt: 1 });

// Auto-fix: Drop old tokenHash index if exists (for migration from old schema)
SessionSchema.on("index" as any, async function(this: any) {
  try {
    const collection = this.collection;
    const indexes = await collection.indexes();
    const hasOldIndex = indexes.some((idx: any) => idx.key && idx.key.tokenHash === 1);
    if (hasOldIndex) {
      console.log("[Session] Dropping old tokenHash index...");
      await collection.dropIndex("tokenHash_1").catch(() => {});
    }
  } catch (e) {
    // Ignore errors during index creation
  }
});

export const Session = 
  models.Session || model("Session", SessionSchema);