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

export const Session = 
  models.Session || model("Session", SessionSchema);