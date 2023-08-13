"use server"

import { revalidatePath } from "next/cache";
import { connectToDB } from "../mongoose";
import User from "../models/user.model";

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