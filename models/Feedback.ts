import mongoose, { Schema, Document, Model } from "mongoose";

export interface IFeedback extends Document {
  issueId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  rating: number;
  comment?: string | null;
  submittedAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    issueId: { type: Schema.Types.ObjectId, ref: "Issue", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: null, trim: true },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

FeedbackSchema.index({ issueId: 1, studentId: 1 }, { unique: true });

const Feedback: Model<IFeedback> =
  (mongoose.models.Feedback as Model<IFeedback>) || mongoose.model<IFeedback>("Feedback", FeedbackSchema);

export default Feedback;
