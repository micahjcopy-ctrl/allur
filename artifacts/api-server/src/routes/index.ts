import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import coachRouter from "./coach";
import meRouter from "./me";
import stripeRouter from "./stripe";
import socialRouter from "./social";
import cardioRouter from "./cardio";
import supportRouter from "./support";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(coachRouter);
router.use(meRouter);
router.use(stripeRouter);
router.use(socialRouter);
router.use(cardioRouter);
router.use(supportRouter);

export default router;
