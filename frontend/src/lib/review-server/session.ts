// Compatibility exports for the established route files. All identity checks
// now use FastAPI/PostgreSQL; no review cookie or private account list is read.
export {currentAccountRole as currentReviewRole, requireAccountRole as requireReviewRole} from "@/lib/auth/server";
