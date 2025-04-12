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
    title: "SP NIST 800-171 Rev 3",
    description: "NIST 800-171 Rev 3",
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
                className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-900 text-gray-100`}
            >
                {children}
            </body>
        </html>
    );
}
