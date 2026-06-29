import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import coachRouter from "./coach";
import meRouter from "./me";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(coachRouter);
router.use(meRouter);
router.use(stripeRouter);

export default router;
