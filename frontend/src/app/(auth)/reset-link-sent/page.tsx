import {Suspense} from "react";
import {BrandLoading} from "@/components/common/brand-loading";
import {AuthScreenView} from "@/components/features/auth/auth-screen";
export const metadata={robots:{index:false,follow:false}};
export default function Page() {return <Suspense fallback={<BrandLoading />}><AuthScreenView screen="reset-link-sent" /></Suspense>;}
