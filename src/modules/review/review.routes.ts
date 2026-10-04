import { Router } from "express";
import * as ctrl from "./review.controller";
import { requireAuth, requireAdmin } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { submitReviewSchema } from "./review.validation";

const router = Router();

router.get("/reviews", ctrl.getAllReviews);
router.post("/reviews", requireAuth, validateRequest(submitReviewSchema), ctrl.submitReview);
router.delete("/reviews/:id", requireAdmin, ctrl.deleteReview);

export default router;
