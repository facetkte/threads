"use server"

import { revalidatePath } from "next/cache";
import { connectToDB } from "../mongoose";
import User from "../models/user.model";
import Thread from "../models/thread.model";
import { FilterQuery, SortOrder } from "mongoose";

interface Params {
    userId: string;
    username: string;
    name: string;
    bio: string;
    image: string;
    path: string;
};

export async function updateUser({ userId, username, name, bio, image, path }: Params): Promise<void> {

    // 需要model才能對資料庫更改(建立use.model.ts
    try {
        connectToDB();
        await User.findOneAndUpdate(
            { id: userId },
            {
                username: username.toLowerCase(),
                name,
                bio,
                image,
                onboarded: true
            },
            { upsert: true }
        );
        //以下可建立第一筆users
        // const initialUser = new User({
        //     id: userId,
        //     username: username,
        //     name: name,
        //     bio: bio,
        //     image: image,
        //     onboarded: true,
        //     community: [],
        //     threads: []
        // });
        // console.log(initialUser);
        // initialUser.save()
        //     .then((savedUser: any) => {
        //         console.log('First user inserted:', savedUser);
        //     })
        //     .catch((error: any) => {
        //         console.error('Error inserting first user:', error);
        //     });

        if (path === "/profile/edit") {
            revalidatePath(path);//更新後不需等待重新驗證
        }
    }
    catch (err: any) {
        throw new Error(`Failed to create/update user: ${err.message}`);
    }
}

export async function fetchUser(userId: string) {
    try {
        connectToDB();

        return await User
            .findOne({ id: userId })
        // .populate({path: 'community', model: Community})
    }
    catch (err: any) {
        throw new Error(`Failed to fetch user:${err.message}`)
    }
}

export async function fetchUserPosts(userId: string) {
    try {
        connectToDB();

        const threads = await User.findOne({ id: userId })
            .populate({
                path: 'threads',
                model: Thread,
                populate: {
                    path: 'children',
                    model: Thread,
                    populate: {
                        path: 'author',
                        model: User,
                        select: 'name image id'
                    }
                }
            })

        return threads;
    }
    catch (err: any) {
        throw new Error(`Failed to fetch Posts:${err.message}`)
    }
}

export async function fetchUsers({
    userId,
    searchString = "",
    pageNumber = 1,
    pageSize = 20,
    sortBy = "desc"
}: {
    userId: string;
    searchString?: string;
    pageNumber: number;
    pageSize: number;
    sortBy?: SortOrder
}) {
    try {
        connectToDB();

        const skipAmount = (pageNumber - 1) * pageSize;
        const regex = new RegExp(searchString, "i");
        //not equal = ne
        const query: FilterQuery<typeof User> = {
            id: { $ne: userId }
        }
        if (searchString.trim() !== "") {
            query.$or = [
                { username: { $regex: regex } },
                { name: { $regex: regex } }
            ]
        }

        const sortOptions = { createdAt: sortBy };

        //
        const userQuery = User.find(query)
            .sort(sortOptions)
            .skip(skipAmount)
            .limit(pageSize);

        const totalUsersCount = await User.countDocuments(query);

        const users = await userQuery.exec();

        const isNext = totalUsersCount > skipAmount + users.length;

        return { users, isNext };
    }
    catch (err: any) {
        throw new Error(`Failed to fetch Users:${err.message}`)
    }
}

export async function getActivity(userId: string) {
    try {
        connectToDB();

        //find threds by user
        const userThreads = await Thread.find({ author: userId });

        //collect all child thread form 'children' {1,children:['a','b','c']},{2,children:['e','f']} => [a,b,c,e,f]
        const childThreadIds = userThreads.reduce((acc, userThread) => {
            return acc.concat(userThread.children)
        }, [])

        const replies = await Thread.find({
            _id: { $in: childThreadIds },
            author: { $ne: userId }
        }).populate({
            path: 'author',
            model: User,
            select: 'name image _id'
        })

        return replies;
    }
    catch (err: any) {
        throw new Error(`Failed to fetch activity: ${err.message}`)
    }
}