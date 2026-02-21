"use client";

import dynamic from "next/dynamic";

const AdminDashboardContent = dynamic(
    () => import("@/components/AdminDashboardContent"),
    { ssr: false }
);

export default function AdminDashboardPage() {
    return <AdminDashboardContent />;
}
