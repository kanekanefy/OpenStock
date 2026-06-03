import { betterAuth } from "better-auth";
import {mongodbAdapter} from "better-auth/adapters/mongodb";
import {connectToDatabase} from "@/database/mongoose";
import {nextCookies} from "better-auth/next-js";
import { sendPasswordResetEmail } from "@/lib/nodemailer/reset-password";


let authInstance: ReturnType<typeof betterAuth> | null = null;


export const getAuth = async () => {
    if(authInstance) {
        return authInstance;
    }

    const mongoose = await connectToDatabase();
    const db = mongoose.connection;
    const database = db.db;

    if (!db || !database) {
        throw new Error("MongoDB connection not found!");
    }

    authInstance = betterAuth({
        database: mongodbAdapter(database),
       secret: process.env.BETTER_AUTH_SECRET,
        baseURL: process.env.BETTER_AUTH_URL,
        emailAndPassword: {
            enabled: true,
            disableSignUp: false,
            requireEmailVerification: false,
            minPasswordLength: 8,
            maxPasswordLength: 128,
            autoSignIn: true,
            sendResetPassword: async ({ user, url }) => {
                void sendPasswordResetEmail({
                    email: user.email,
                    name: user.name,
                    resetUrl: url,
                }).catch((error) => {
                    console.error('Failed to queue password reset email:', error);
                });
            },
        },
        plugins: [nextCookies()],

    });

    return authInstance;
}

// Lazily initialize Better Auth on first *use* rather than at module load.
//
// The previous `export const auth = await getAuth()` opened a MongoDB connection at
// import time. `next build` evaluates every module while collecting page data, so the
// build connected to the database — which fails when the DB is only reachable at runtime
// (e.g. an internal Dokploy database service that does not exist during the image build).
//
// This Proxy defers the connection until a method is actually invoked at request time.
// Every call site uses the shape `await auth.api.<method>(...)`, which this preserves.
type AuthInstance = Awaited<ReturnType<typeof getAuth>>;

export const auth = new Proxy({} as AuthInstance, {
    get(_target, prop: string) {
        if (prop === "api") {
            return new Proxy(
                {},
                {
                    get(_t, method: string) {
                        return async (...args: unknown[]) => {
                            const instance = await getAuth();
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            return (instance.api as any)[method](...args);
                        };
                    },
                }
            );
        }
        return async (...args: unknown[]) => {
            const instance = await getAuth();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (instance as any)[prop](...args);
        };
    },
});
