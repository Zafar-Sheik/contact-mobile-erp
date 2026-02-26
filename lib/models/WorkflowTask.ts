import { Schema, model, models } from "mongoose";
import { addBaseFields, baseOptions, softDeletePlugin } from "./_base";

const WorkflowTaskSchema = new Schema(
  addBaseFields({
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 8000 },

    status: { type: String, enum: ["Todo", "InProgress", "Blocked", "Done", "Cancelled"], default: "Todo", index: true },
    priority: { type: String, enum: ["Low", "Normal", "High", "Urgent"], default: "Normal", index: true },

    assigneeId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },

    dueAt: { type: Date, default: null, index: true },
    completedAt: { type: Date, default: null },

    tags: [{ type: String, trim: true, maxlength: 40 }],
  }),
  baseOptions,
);

WorkflowTaskSchema.plugin(softDeletePlugin);
WorkflowTaskSchema.index({ companyId: 1, status: 1, dueAt: 1 });

export const WorkflowTask =
  models.WorkflowTask || model("WorkflowTask", WorkflowTaskSchema);