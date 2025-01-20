import express from "express"
import { activate, add_companion_test_question, delete_question, get_all_questions, update_question, get_all_users, suspend, isSuspended, updateReportStatus } from "../controllers/adminController.js";
import {authenticateToken} from "../config/middlewares.js";

const adminRouter = express.Router()

adminRouter.post("/questions", authenticateToken, add_companion_test_question)
adminRouter.get("/questions", get_all_questions)
adminRouter.delete("/questions/:id", authenticateToken, delete_question)
adminRouter.put("/questions/:id", authenticateToken, update_question)
adminRouter.get("/users", authenticateToken, get_all_users)

adminRouter.post("/suspend", authenticateToken, suspend)
adminRouter.post("/activate", authenticateToken, activate)
adminRouter.get("/suspension/:email", authenticateToken, isSuspended)

adminRouter.patch("/reports/:id/status", authenticateToken, updateReportStatus)

export default adminRouter