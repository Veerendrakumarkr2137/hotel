import { Router } from "express";
import { getGallery, addGalleryImage, deleteGalleryImage } from "../controllers/galleryController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

router.get("/", getGallery);
router.post("/", requireAuth("admin"), addGalleryImage);
router.delete("/:id", requireAuth("admin"), deleteGalleryImage);

export default router;
