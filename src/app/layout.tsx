import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
    src: "./fonts/GeistVF.woff",
    variable: "--font-geist-sans",
    weight: "100 900",
});
const geistMono = localFont({
    src: "./fonts/GeistMonoVF.woff",
    variable: "--font-geist-mono",
    weight: "100 900",
});

export const metadata: Metadata = {
    title: "STIG",
    description: "STIG",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <head>
                <script src="/service-worker.js" />
            </head>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased dark:bg-zinc-900 dark:text-zinc-100`}
            >
                {children}
            </body>
        </html>
    );
}
