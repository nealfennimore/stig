"use client";
import {
    Checklist,
    Convert,
    Rule,
    Severity,
    Status,
    TargetData,
} from "@/api/generated/Checklist";
import { RuleEdit } from "@/app/components/client/editor/rule";
import { Sidebar } from "@/app/components/sidebar";
import { IDB, IDBChecklist } from "@/app/db";
import { debounce, download } from "@/app/utils";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Breadcrumbs } from "./breadcrumbs";
import { ChecklistTargetData } from "./checklist_target_data";
import { SeverityBadge, bySeverity } from "./severity";
import { StatusBadge, byStatus } from "./status";
import { Order, Table, defaultFilter, defaultSort } from "./table";

const sorters = [defaultSort, bySeverity, byStatus, null];
const filters = [null, null, defaultFilter, null];

const compare = (a: { [key: string]: any }, b: { [key: string]: any }) => {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
        return false;
    }
    for (const key of aKeys) {
        const aValue = a?.[key] as object | string | number | boolean;
        const bValue = b?.[key] as object | string | number | boolean;

        if (typeof aValue === "object" && typeof bValue === "object") {
            if (!compare(aValue, bValue)) {
                return false;
            }
        } else {
            if (aValue !== bValue) {
                return false;
            }
        }
    }
    return true;
};

type FormRuleProperties = Pick<
    Rule,
    "overrides" | "status" | "comments" | "finding_details"
>;

interface FormChecklistChanges {
    rule: Record<string, FormRuleProperties>;
    target_data: Record<string, TargetData>;
}

const toCKLB = (checklist: Checklist) => {
    const blob = new Blob([Convert.checklistToJson(checklist)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    download(url, `checklist-${checklist.id}.cklb`);
    URL.revokeObjectURL(url);
};

const tableHeaders = [
    { text: "Status" },
    { text: "Severity" },
    { text: "Title" },
    { text: "Description", className: "max-lg:hidden" },
];
export const ChecklistView = ({ checklistId }: { checklistId: string }) => {
    const [checklist, setChecklist] = useState<Checklist | null>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const [severities, setSeverities] = useState<Set<Severity>>(new Set());
    const [statuses, setStatuses] = useState<Set<Status>>(new Set());
    const [selectedIdx, setRowIdx] = useState<number | null>(null);

    useEffect(() => {
        (async () => {
            const checklist = await IDB.exportChecklist(checklistId);
            setChecklist(checklist);
        })();
    }, [checklistId]);

    const currentRules = useMemo(() => {
        if (!checklist) {
            return {};
        }
        return checklist.stigs
            .flatMap((stig) => stig.rules)
            .reduce((acc, rule) => {
                acc[rule.uuid] = rule;
                return acc;
            }, {} as Record<string, Rule>);
    }, [checklist]);

    const viewableRules = useMemo(() => {
        if (!currentRules) {
            return [];
        }
        return Object.values(currentRules).filter((rule) => {
            const severity =
                rule.overrides?.severity?.severity ?? rule.severity;
            const status = rule.status;

            if (severities.size > 0 && !severities.has(severity)) {
                return false;
            }
            if (statuses.size > 0 && !statuses.has(status)) {
                return false;
            }
            return true;
        });
    }, [currentRules, severities, statuses]);

    const counts = useMemo(() => {
        const counts: {
            severity: Record<Severity, number>;
            status: Record<Status, number>;
        } = {
            severity: {} as Record<Severity, number>,
            status: {} as Record<Status, number>,
        };
        Object.values(currentRules).forEach((rule) => {
            const severity =
                rule.overrides?.severity?.severity ?? rule.severity;
            const status = rule.status;

            if (!counts.severity[severity]) {
                counts.severity[severity] = 0;
            }
            counts.severity[severity]++;

            if (!counts.status[status]) {
                counts.status[status] = 0;
            }
            counts.status[status]++;
        });

        return {
            severity: Object.entries(counts.severity).sort(([a], [b]) =>
                bySeverity(b as Severity, a as Severity)
            ),
            status: Object.entries(counts.status).sort(([a], [b]) =>
                byStatus(b as Status, a as Status)
            ),
        };
    }, [currentRules]);

    const rule = useMemo(
        () =>
            selectedIdx !== null && selectedIdx > -1
                ? viewableRules?.[selectedIdx]
                : null,
        [selectedIdx]
    );

    const handleChange = useMemo(
        () => (e: Event) => {
            if (!formRef.current) {
                return;
            }
            const formData = new FormData(formRef.current);
            let data = { rule: {}, target_data: {} } as FormChecklistChanges;
            let updates = [];

            for (const [key, value] of formData.entries()) {
                const [type, uuid, ...paths] = key.split(".");
                if (type !== "target_data" && type !== "rule") {
                    continue;
                }

                let length = paths.length;
                let currentRule = currentRules[uuid];

                if (type === "rule") {
                    // @ts-ignore
                    if (
                        length === 1 &&
                        // @ts-ignore
                        currentRule?.[paths[0]] === value
                    ) {
                        continue;
                    }

                    if (!data.rule[uuid]) {
                        data.rule[uuid] = {} as FormRuleProperties;
                    }
                    let nextRuleData = data.rule[uuid];
                    for (const [idx, path] of paths.entries()) {
                        // @ts-ignore
                        if (nextRuleData[path] === undefined && length > 1) {
                            // @ts-ignore
                            nextRuleData[path] = {};
                        }
                        if (idx === length - 1) {
                            // @ts-ignore
                            nextRuleData[path] = value;
                        } else {
                            // @ts-ignore
                            nextRuleData = nextRuleData[path];
                        }
                    }
                } else if (type === "target_data") {
                    if (!data.target_data[uuid]) {
                        data.target_data[uuid] = {
                            is_web_database: false,
                        } as TargetData;
                    }
                    const path = paths[0];
                    if (path === "is_web_database") {
                        data.target_data[uuid][path] =
                            value === "true" || value === "on";
                    } else {
                        data.target_data[uuid][path] = value;
                    }
                }
            }
            for (const [uuid, value] of Object.entries(data.rule)) {
                // Skip if only overrides are changed
                // and the overrides are the same as the current overrides
                if (
                    Object.keys(value).length === 1 &&
                    value.overrides &&
                    compare(value.overrides, currentRules[uuid].overrides)
                ) {
                    continue;
                }
                let rule = {
                    ...currentRules[uuid],
                    ...value,
                    uuid,
                } as Rule;
                updates.push(IDB.rules.put(rule));
            }

            for (const [uuid, value] of Object.entries(data.target_data)) {
                // Skip if only target_data is changed
                // and the target_data is the same as the current target_data
                if (compare(value, checklist?.target_data as TargetData)) {
                    continue;
                }
                const nextChecklist = {
                    ...checklist,
                    target_data: {
                        ...checklist?.target_data,
                        ...value,
                    },
                } as IDBChecklist;
                updates.push(IDB.checklists.put(nextChecklist));
            }

            Promise.all(updates).then(async () => {
                const checklist = await IDB.exportChecklist(checklistId);
                setChecklist(checklist);
            });
        },
        [viewableRules, currentRules, rule]
    );

    const debouncedHandleChange = useMemo(
        () => debounce(handleChange, 500),
        [handleChange]
    );

    const tableBody = useMemo(() => {
        return viewableRules.map((rule, idx) => ({
            onClick: () => setRowIdx(idx),
            values: [
                rule.status,
                rule.overrides?.severity?.severity ?? rule.severity,
                rule.rule_title,
                rule.discussion,
            ],
            columns: [
                <StatusBadge status={rule.status} />,
                <SeverityBadge
                    severity={
                        rule.overrides?.severity?.severity ?? rule.severity
                    }
                />,
                rule.rule_title,
                rule.discussion,
            ],
            classNames: [null, null, null, "max-lg:hidden"],
        }));
    }, [viewableRules]);

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <form
                ref={formRef}
                onSubmit={(e) => e.preventDefault()}
                onChange={debouncedHandleChange}
            >
                <Breadcrumbs editor />
                <Sidebar
                    isOpen={rule !== null}
                    onClick={() => setRowIdx(null)}
                    headerText={rule?.rule_title ?? "Rule Details"}
                >
                    <RuleEdit rule={rule} />
                </Sidebar>

                {checklist?.stigs.map((stig) => (
                    <div key={stig.uuid}>
                        <section className="my-4 w-full flex flex-col">
                            <h1 className="text-3xl my-6">
                                {checklist?.title}
                            </h1>
                            <ChecklistTargetData checklist={checklist} />
                            <div className="w-full flex flex-col justify-between">
                                <div className="text-zinc-600 dark:text-zinc-500 text-xs mr-4 flex justify-between">
                                    <span>{stig.display_name}</span>
                                    <span>Version {stig.version}</span>
                                </div>
                                <div className="text-zinc-600 dark:text-zinc-500 text-xs mr-4 flex justify-between">
                                    <span>{stig.size} rules</span>
                                    <span>{stig.release_info}</span>
                                </div>
                                <div className="text-zinc-600 dark:text-zinc-500 text-xs mr-4 flex justify-end">
                                    <button
                                        onClick={() => toCKLB(checklist)}
                                        className="text-zinc-600 dark:text-zinc-500 text-xs flex flex-col"
                                    >
                                        CKLB ⬇️
                                    </button>
                                </div>
                            </div>
                        </section>

                        <aside className="w-full flex justify-between items-center my-6">
                            <div>
                                {counts.severity.map(([severity, count]) => (
                                    <SeverityBadge
                                        key={severity}
                                        severity={severity as Severity}
                                        count={count}
                                        Element="button"
                                        selected={severities.has(
                                            severity as Severity
                                        )}
                                        onClick={() => {
                                            const newSeverities = new Set(
                                                severities
                                            );
                                            if (
                                                newSeverities.has(
                                                    severity as Severity
                                                )
                                            ) {
                                                newSeverities.delete(
                                                    severity as Severity
                                                );
                                            } else {
                                                newSeverities.add(
                                                    severity as Severity
                                                );
                                            }
                                            setSeverities(newSeverities);
                                        }}
                                    />
                                ))}
                            </div>
                            <div>
                                {counts.status.map(([status, count]) => (
                                    <StatusBadge
                                        key={status}
                                        status={status as Status}
                                        count={count}
                                        Element="button"
                                        selected={statuses.has(
                                            status as Status
                                        )}
                                        onClick={() => {
                                            const newStatuses = new Set(
                                                statuses
                                            );
                                            if (
                                                newStatuses.has(
                                                    status as Status
                                                )
                                            ) {
                                                newStatuses.delete(
                                                    status as Status
                                                );
                                            } else {
                                                newStatuses.add(
                                                    status as Status
                                                );
                                            }
                                            setStatuses(newStatuses);
                                        }}
                                    />
                                ))}
                            </div>
                        </aside>
                        <section className="w-full flex flex-col">
                            <Table
                                formRef={formRef}
                                filters={filters}
                                sorters={sorters}
                                tableHeaders={tableHeaders}
                                tableBody={tableBody}
                                initialOrders={[
                                    Order.NONE,
                                    Order.DESC,
                                    Order.NONE,
                                    Order.NONE,
                                ]}
                            />
                        </section>
                    </div>
                ))}
            </form>
        </Suspense>
    );
};
