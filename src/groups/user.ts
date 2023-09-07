import user from '../user';
import db from '../database';
// import { isMemberOfGroups } from './membership';
// // import group_mem = require('./membership');
import * as group_mem from './membership';

import * as group_index from './index';
import * as group_ownership from './ownership';
import { StatusObject } from '../types/status';
import { GroupDataObject } from '../types/group';

/* eslint-disable max-len */

// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call

type UserClass = {
    uid?: number;
    username?: string;
    displayname?: string;
    userslug?: string;
    picture?: string;
    status?: StatusObject;
    postcount?: number;
    reputation?: number;
    'email:confirmed'?: number;
    lastonline?: number;
    flags?: number;
    banned?: number;
    'banned:expire'?: number;
    joindate?: number;
    accounttype?: string;
    'icon:text'?: string;
    'icon:bgColor'?: string;
    joindateISO?: string;
    lastonlineISO?: string;
    banned_until?: number;
    banned_until_readable?: string;
    email?: string;
    fullname?: string;
    location?: string;
    birthday?: string;
    website?: string;
    aboutme?: string;
    signature?: string;
    uploadedpicture?: string;
    profileviews?: number;
    topiccount?: number;
    lastposttime?: number;
    followerCount?: number;
    followingCount?: number;
    'cover:url'?: string;
    'cover:position'?: string;
    groupTitle?: string;
    groupTitleArray?: string[];
    mutedUntil?: Date;
    mutedReason?: string;
}

type GroupClass = GroupDataObject & {
    getUsersFromSet?: (set: string, fields: Array<string>) => Promise<UserClass[]>;
    getUserGroups?: (uids: string[]) => Promise<string[][]>;
    getUserGroupsFromSet?: (set: string, uids:string[]) => Promise<string[][]>;
    getUserGroupMembership?: (set:string, uids:string[]) => Promise<string[][]>;
    getGroupsData?: (memberOf: string[]) => Promise<string[]>;
    // isMemberOfGroups?: (uid:number, groupName:number[]) => Promise<number[]>;
    getUserInviteGroups?: (uid:string) => Promise<GroupDataObject[]>;
    // getNonPrivilegeGroups?: (set:string, start:number, stop:number) => Promise<GroupDataObject[]>;
    ephemeralGroups?: string[];
}

export = function (Groups_special: GroupClass) {
    async function findUserGroups(uid: string, groupNames: string[]): Promise<string[]> {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const isMembers:string[] = await group_mem.isMemberOfGroups(uid, groupNames) as string[];
        return groupNames.filter((name, i) => isMembers[i]);
    }

    Groups_special.getUsersFromSet = async function (set:string, fields:Array<string>) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const uids:string[] = await db.getSetMembers(set) as string[];
        if (fields) {
            // The next line calls a function in a module that has not been updated to TS yet
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            return await user.getUsersFields(uids, fields) as UserClass[];
        }
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return await user.getUsersData(uids) as UserClass[];
    };

    Groups_special.getUserGroups = async function (uids) {
        return await Groups_special.getUserGroupsFromSet('groups:visible:createtime', uids);
    };

    Groups_special.getUserGroupsFromSet = async function (set, uids) {
        const memberOf = await Groups_special.getUserGroupMembership(set, uids);
        return await Promise.all(memberOf.map(memberOf => Groups_special.getGroupsData(memberOf)));
    };

    Groups_special.getUserGroupMembership = async function (set, uids) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const groupNames:string[] = await db.getSortedSetRevRange(set, 0, -1) as string[];
        return await Promise.all(uids.map(uid => findUserGroups(uid, groupNames)));
    };

    Groups_special.getUserInviteGroups = async function (uid) {
        // The next line calls a function in a module that has not been updated to TS yet
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        let allGroups:GroupDataObject[] = await group_index.getNonPrivilegeGroups('groups:createtime', 0, -1) as GroupDataObject[];
        allGroups = allGroups.filter(group => !Groups_special.ephemeralGroups.includes(group.name));

        const publicGroups = allGroups.filter(group => group.hidden === 0 && group.system === 0 && group.private === 0);
        const adminModGroups = [
            { name: 'administrators', displayName: 'administrators' },
            { name: 'Global Moderators', displayName: 'Global Moderators' },
        ];
        // Private (but not hidden)
        const privateGroups = allGroups.filter(group => group.hidden === 0 &&
            group.system === 0 && group.private === 1);
        const [ownership, isAdmin, isGlobalMod]:boolean[][] = await Promise.all([
            // The next line calls a function in a module that has not been updated to TS yet
            //  eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
            Promise.all(privateGroups.map(group => group_ownership.ownership.isOwner(uid, group.name) as boolean)),
            user.isAdministrator(uid) as boolean[],
            user.isGlobalModerator(uid) as boolean[],
        ]);
        const ownGroups = privateGroups.filter((group, index) => ownership[index]);

        let inviteGroups = [];
        if (isAdmin) {
            inviteGroups = inviteGroups.concat(adminModGroups).concat(privateGroups);
        } else if (isGlobalMod) {
            inviteGroups = inviteGroups.concat(privateGroups);
        } else {
            inviteGroups = inviteGroups.concat(ownGroups);
        }

        return inviteGroups
            .concat(publicGroups) as GroupDataObject[];
    };
}
