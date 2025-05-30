"use client";

import React from "react";

type Props = {
    isOpen: boolean;
    children: React.ReactNode;
    onClick?: () => void;
    headerText: React.ReactNode;
};

export const Sidebar = ({
    isOpen = true,
    children,
    onClick,
    headerText = "",
}: Props) => {
    const className = isOpen ? "transform-none" : "translate-x-full";

    return (
        <aside
            id="drawer-navigation"
            className={`fixed top-0 right-0 z-40 w-fit max-w-5xl h-screen p-4 overflow-y-auto transition-transform bg-white dark:bg-zinc-900 sm:max-w-screen border-l border-zinc-300 dark:border-zinc-700 ${className}`}
            tabIndex={-1}
            aria-labelledby="drawer-navigation-label"
        >
            <h5
                id="drawer-navigation-label"
                className="text-base font-semibold text-gray-500 uppercase dark:text-gray-400"
            >
                {headerText}
            </h5>
            <button
                type="button"
                data-drawer-hide="drawer-navigation"
                aria-controls="drawer-navigation"
                className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 absolute top-2.5 end-2.5 inline-flex items-center dark:hover:bg-gray-600 dark:hover:text-white"
                onClick={onClick}
            >
                <svg
                    aria-hidden="true"
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                    ></path>
                </svg>
                <span className="sr-only">Close menu</span>
            </button>
            <div className="py-4 overflow-y-auto flex flex-col gap-6">
                {children}
            </div>
        </aside>
    );
};
