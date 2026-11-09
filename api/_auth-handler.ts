import { queryOne } from "./_db";
import { requireUser, signToken, verifyPassword } from "./_auth";
import { isAtlasOwner } from "./_owner";
export async function handleAuthRequest(
  req: { method?: string; headers: any; body?: any },
  res: { status(code: number): any; json(body: any): any },
  path: string,
) {
  try {
    if (path === "register" && req.method === "POST")
      return res
        .status(403)
        .json({ error: "Atlas adalah aplikasi pribadi. Pendaftaran ditutup." });
    if (path === "login" && req.method === "POST") {
      const { email, password } = req.body || {};
      if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        email.length > 254 ||
        password.length > 1000
      )
        return res
          .status(400)
          .json({ error: "Email dan kata sandi tidak valid." });
      const user = await queryOne(
        "SELECT id,email,password_hash,salt,display_name,timezone,morning_brief_time FROM users WHERE email=$1",
        [email.toLowerCase().trim()],
      );
      if (!user || !verifyPassword(password, user.salt, user.password_hash))
        return res.status(401).json({ error: "Email atau kata sandi salah." });
      if (!(await isAtlasOwner(user)))
        return res
          .status(403)
          .json({
            error:
              "Atlas hanya tersedia untuk akun pemilik. Periksa konfigurasi pemilik jika ini akunmu.",
          });
      const { password_hash, salt, ...publicUser } = user;
      return res.json({ token: signToken({ sub: user.id }), user: publicUser });
    }
    if (path === "me") {
      const { user, error } = await requireUser(req);
      if (!user || error)
        return res.status(401).json({ error: error || "Unauthorized" });
      if (req.method === "GET") return res.json({ user });
      if (req.method === "PATCH") {
        const out: Record<string, string> = {};
        for (const [key, value] of Object.entries(req.body || {})) {
          if (
            !["display_name", "timezone", "morning_brief_time"].includes(key) ||
            typeof value !== "string" ||
            value.length > 100
          )
            return res.status(400).json({ error: "Profil akun tidak valid." });
          if (key === "timezone") {
            try {
              new Intl.DateTimeFormat("en", { timeZone: value });
            } catch {
              return res.status(400).json({ error: "Zona waktu tidak valid." });
            }
          }
          if (
            key === "morning_brief_time" &&
            !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)
          )
            return res.status(400).json({ error: "Jam tidak valid." });
          out[key] = value;
        }
        const keys = Object.keys(out);
        if (!keys.length) return res.json({ user });
        const updated = await queryOne(
          `UPDATE users SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(",")} WHERE id=$1 RETURNING id,email,display_name,timezone,morning_brief_time`,
          [user.id, ...Object.values(out)],
        );
        return res.json({ user: updated });
      }
    }
    return res.status(404).json({ error: "Not found" });
  } catch (error: any) {
    return res
      .status(503)
      .json({
        error: ["42P01", "42703"].includes(error.code)
          ? "Jalankan migrasi database untuk mengaktifkan Atlas pribadi."
          : "Akun belum dapat diperiksa. Coba lagi saat koneksi tersedia.",
      });
  }
}
