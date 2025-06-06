import {
    Convert,
    Group as IGroup,
    Profile as IProfile,
    Rule as IRule,
    Select as ISelect,
    Stig as IStig,
} from '@/api/generated/Stig';

// export const dynamic = 'force-dynamic';
// export const fetchCache = 'force-no-store';

export enum Classification {
    Public = 'Public',
    Classified = 'Classified',
    Sensitive = 'Sensitive',
}

export enum Priority {
    Critical = 'MAC-1',
    MissionSupport = 'MAC-2',
    Administrative = 'MAC-3',
}

export enum ClassificationWithPriority {
    Critical_Public = 'MAC-1_Public',
    Critical_Classified = 'MAC-1_Classified',
    Critical_Sensitive = 'MAC-1_Sensitive',
    MissionSupport_Public = 'MAC-2_Public',
    MissionSupport_Classified = 'MAC-2_Classified',
    MissionSupport_Sensitive = 'MAC-2_Sensitive',
    Administrative_Public = 'MAC-3_Public',
    Administrative_Classified = 'MAC-3_Classified',
    Administrative_Sensitive = 'MAC-3_Sensitive',
}

export class RuleWrapper {
    private _rule: IRule;
    constructor(rule: IRule) {
        this._rule = rule;
    }
    get rule() {
        return this._rule;
    }
    get id() {
        return this._rule['+@id'];
    }
    get title() {
        return this._rule.title;
    }
    get description() {
        const [_, description] = this._rule.description.match(
            /<VulnDiscussion>(.*)<\/VulnDiscussion>/s
        ) ?? [null, null];
        return description ? description : this._rule.description;
    }
    get severity() {
        return this._rule['+@severity'];
    }
    get fixText() {
        return this._rule.fixtext['+content'];
    }
    get fix() {
        return this._rule.fix['+@id'];
    }
    get checkId() {
        return this._rule.check['+@system'];
    }
    get check() {
        return this._rule.check['check-content'];
    }
    get version() {
        return this._rule.version;
    }

    get reference() {
        return this._rule.reference;
    }
}
export class GroupWrapper {
    private _group: IGroup;
    constructor(group: IGroup) {
        this._group = group;
    }
    get group() {
        return this._group;
    }
    get id() {
        return this._group['+@id'];
    }
    get title() {
        return this._group.title;
    }
    get description() {
        return this._group.description;
    }

    get rule() {
        return new RuleWrapper(this._group.Rule);
    }
}

export class SelectWrapper {
    private _select: ISelect;
    constructor(select: ISelect) {
        this._select = select;
    }
    get select() {
        return this._select;
    }
    get id() {
        return this._select['+@idref'];
    }
    get selected() {
        return this._select['+@selected'];
    }
}

export class ProfileWrapper {
    private _profile: IProfile;
    constructor(profile: IProfile) {
        this._profile = profile;
    }
    get profile() {
        return this._profile;
    }
    get id() {
        return this._profile['+@id'] as ClassificationWithPriority;
    }

    get priority() {
        return this.id.split('_')[0] as Priority;
    }

    get classification() {
        return this.id.split('_')[1] as Classification;
    }

    get title() {
        return this._profile.title;
    }
    get description() {
        return this._profile.description;
    }
    get select() {
        const select = Array.isArray(this._profile.select)
            ? this._profile.select
            : [this._profile.select];
        return select.map((select) => new SelectWrapper(select));
    }
}

export class StigWrapper {
    private _stig: IStig;
    constructor(stig: IStig) {
        this._stig = stig;
    }
    get stig() {
        return this._stig;
    }
    get id() {
        return this._stig.Benchmark['+@id'];
    }
    get title() {
        return this._stig.Benchmark.title;
    }

    get metaTitle() {
        return this._stig.Benchmark.title.replace(
            'Security Requirements Guide',
            ''
        );
    }

    get description() {
        return this._stig.Benchmark.description;
    }

    get publisher() {
        return this._stig.Benchmark.reference.publisher;
    }

    get tags() {
        let plainText = this._stig.Benchmark['plain-text'];
        if (!Array.isArray(plainText)) {
            plainText = [plainText];
        }
        return plainText.map((item) => item['+content']);
    }

    get groups() {
        const groups = Array.isArray(this._stig.Benchmark.Group)
            ? this._stig.Benchmark.Group
            : [this._stig.Benchmark.Group];

        return groups.map((group) => new GroupWrapper(group));
    }

    get classificationLevels() {
        return Object.values(Classification);
    }

    get profiles() {
        return this._stig.Benchmark.Profile.map(
            (profile) => new ProfileWrapper(profile)
        );
    }

    get profilesByClassification() {
        return this.profiles.reduce((acc, profile) => {
            const classification = profile.classification;
            const priority = profile.priority;
            if (!acc[classification]) {
                acc[classification] = {} as Record<Priority, ProfileWrapper[]>;
            }
            if (!acc[classification][priority]) {
                acc[classification][priority] = [];
            }
            acc[classification][priority].push(profile);
            return acc;
        }, {} as Record<Classification, Record<Priority, ProfileWrapper[]>>);
    }

    get rawProfilesByClassification() {
        return this._stig.Benchmark.Profile.reduce((acc, profile) => {
            const [priority, classification] = profile['+@id'].split('_') as [
                Priority,
                Classification
            ];
            if (!acc[classification]) {
                acc[classification] = {} as Record<Priority, IProfile[]>;
            }
            if (!acc[classification][priority]) {
                acc[classification][priority] = [];
            }
            acc[classification][priority].push(profile);
            return acc;
        }, {} as Record<Classification, Record<Priority, IProfile[]>>);
    }

    groupsByProfiles(profiles: ProfileWrapper[]) {
        const profileIds = profiles.reduce((acc, profile) => {
            profile.select.forEach((select) => {
                acc[select.id] = true;
            });
            return acc;
        }, {} as Record<string, boolean>);
        return this.groups.reduce((acc, group) => {
            if (!!profileIds[group.id]) {
                acc[group.id] = group;
            }
            return acc;
        }, {} as Record<string, GroupWrapper>);
    }

    get version() {
        return this._stig.Benchmark.version;
    }
    get date() {
        return this._stig.Benchmark.status['+@date'];
    }
}

export default class Stig extends Convert {
    private static cache = new Map<string, Promise<string>>();

    static fetch = async (path: string) => {
        if (this.cache.has(path)) {
            return this.cache.get(path);
        }
        const data = fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/data/stigs/schema/${path}?${process.env.NEXT_PUBLIC_MANIFEST_VERSION}`
        ).then((r) => r.text());
        this.cache.set(path, data);
        return data;
    };

    static read = async (path: string) => {
        const data = (await this.fetch(path)) as string;
        const stig: IStig = Stig.toStig(data);
        return new StigWrapper(stig);
    };
}
