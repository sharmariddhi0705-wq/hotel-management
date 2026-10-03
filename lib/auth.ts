import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/schemas/user";

/**
 * Node-runtime Auth.js instance: the edge-safe config plus the Credentials
 * provider, which needs Mongoose and bcrypt.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        await connectToDatabase();

        // `password` is `select: false` on the schema, so ask for it explicitly.
        const user = await User.findOne({ email }).select("+password").exec();

        /**
         * Every failure path returns the same `null`. Distinguishing "no such
         * user" from "wrong password" would let an attacker enumerate accounts,
         * and the comparison still runs on a dummy hash so the response time
         * does not reveal whether the address exists.
         */
        if (!user) {
          await verifyPassword(
            password,
            // A real bcrypt hash of a random throwaway string, so the comparison
            // does the same work it would for a genuine account.
            "$2b$12$IoX2qskfe6DjfY7p0bEQlOjGw64foQY2fvvy2I.CEO.HQ9Kw65oUu",
          );
          return null;
        }

        const valid = await verifyPassword(password, user.password);
        if (!valid) return null;
        if (user.status !== "ACTIVE") return null;

        // Fire-and-forget: a failed timestamp write must not block sign-in.
        User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } })
          .exec()
          .catch(() => undefined);

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          staffId: user.staff ? user.staff.toString() : null,
        };
      },
    }),
  ],
});
