import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem", fontFamily: "Cairo, sans-serif", direction: "rtl" }}>
      <div style={{ maxWidth: 520, width: "100%", textAlign: "center", padding: "2rem", borderRadius: 20, background: "#f6f7f8", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>
        <h1 style={{ margin: 0, fontSize: "3rem", color: "#0f172a" }}>404</h1>
        <h2 style={{ margin: "0.75rem 0", color: "#0f172a" }}>الصفحة غير موجودة</h2>
        <p style={{ margin: "0 0 1.5rem", color: "#475569", lineHeight: 1.7 }}>
          الرابط الذي حاولت الوصول إليه غير موجود أو تم نقله.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            textDecoration: "none",
            background: "#0f766e",
            color: "#fff",
            padding: "0.85rem 1.4rem",
            borderRadius: 12,
            fontWeight: 700,
          }}
        >
          العودة للرئيسية
        </Link>
      </div>
    </main>
  );
}
