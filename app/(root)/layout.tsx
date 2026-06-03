import Header from "@/components/Header";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Footer from "@/components/Footer";
import DonatePopup from "@/components/DonatePopup";
import SirayBanner from "@/components/SirayBanner";

// Opt out of build-time static generation: this layout calls getSession() which
// connects to MongoDB, and the DB is only reachable at runtime (not during build).
export const dynamic = "force-dynamic";

const Layout = async ({ children }: { children: React.ReactNode }) => {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) redirect('/sign-in');

    const user = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
    }

    return (
        <main className="min-h-screen text-gray-400">
            <SirayBanner />
            <Header user={user} />

            <div className="container py-10">
                {children}
            </div>

            <Footer />
            <DonatePopup />
        </main>
    )
}
export default Layout