"use server"

import { revalidatePath } from "next/cache";
import Thread from "../models/thread.model";
import User from "../models/user.model";
import { connectToDB } from "../mongoose";
import { UserValidation } from "../validations/user";

interface Params {
    text: string,
    author: string,
    communityId: string | null,
    path: string,
}

export async function createThread({ text, author, communityId, path }: Params) {

    try {
        connectToDB();
        // const communityIdObject = await Community.findOne(
        //     { id: communityId },
        //     { _id: 1 }
        // );
        const createdThread = await Thread.create({
            text,
            author,
            community: null, // Assign communityId if provided, or leave it null for personal account
        });

        await User.findByIdAndUpdate(author, {
            $push: { threads: createdThread._id },
        });


    }
    catch (err: any) {
        throw new Error(`Failed to create/update thread: ${err.message}`);
    }
}

export async function fetchPosts(pageNumber = 1, pageSize = 20) {

    try {
        connectToDB();

        const skipAmount = (pageNumber - 1) * pageSize;

        const postsQuery = Thread.find({ parentId: { $in: [null, undefined] } })
            .sort({ createdAt: "desc" })
            .skip(skipAmount)
            .limit(pageSize)
            .populate({
                path: "author",
                model: User,
            })
            // .populate({
            //     path: "community",
            //     model: Community,
            // })
            .populate({
                path: "children", // Populate the children field
                populate: {
                    path: "author", // Populate the author field within children
                    model: User,
                    select: "_id name parentId image", // Select only _id and username fields of the author
                },
            });

        const totalPostsCount = await Thread.countDocuments({ parentId: { $in: [null, undefined] } });//總posts數量

        const posts = await postsQuery.exec(); //執行postsQuery查詢，建立關聯時不會直接執行，所有posts資料

        const isNext = totalPostsCount > skipAmount + posts.length;//是否有下一頁

        return { posts, isNext };
    }
    catch (err: any) {
        throw new Error(`Failed to fetch Post: ${err.message}`);
    }
}

export async function fetchThreadById(threadId: string) {
    connectToDB();
    try {
        const thread = await Thread.findById(threadId)
            .populate({
                path: "author",
                model: User,
                select: "_id id name image",
            }) // Populate the author field with _id and username
            // .populate({
            //     path: "community",
            //     model: Community,
            //     select: "_id id name image",
            // }) // Populate the community field with _id and name
            .populate({
                path: "children", // Populate the children field
                populate: [
                    {
                        path: "author", // Populate the author field within children
                        model: User,
                        select: "_id id name parentId image", // Select only _id and username fields of the author
                    },
                    {
                        path: "children", // Populate the children field within children
                        model: Thread, // The model of the nested children (assuming it's the same "Thread" model)
                        populate: {
                            path: "author", // Populate the author field within nested children
                            model: User,
                            select: "_id id name parentId image", // Select only _id and username fields of the author
                        },
                    },
                ],
            })
            .exec();

        return thread;
    }
    catch (err: any) {
        throw new Error(`Fail fetch thread : ${err.message}`);
    }
}

export async function addCommentToThread(
    threadId: string,
    commentText: string,
    userId: string,
    path: string
) {
    connectToDB();
    //找到原本thread by ID
    try {
        const originalThread = await Thread.findById(threadId);

        if (!originalThread) { throw new Error("Thread not found") };

        //新增新的comment
        const commentThread = new Thread({
            text: commentText,
            author: userId,
            parentId: threadId
        })

        const savedCommentThread = await commentThread.save();

        //更新原本thread增加新comment
        originalThread.children.push(savedCommentThread._id);

        //存原本thread
        await originalThread.save();

        revalidatePath(path);
    }
    catch (err: any) {
        console.error("Error while adding comment:", err);
        throw new Error(`Failed to add comment: ${err.message}`);
    }
}