export type StoryVisibility = "private" | "friends" | "public";

export type FriendshipStatus = "pending" | "accepted" | "rejected";

export type FeedPost = {
  storyId: string;
  title: string;
  coverImageUrl: string | null;
  visibility: StoryVisibility;
  ownerId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  likeCount: number;
  likedByMe: boolean;
  isFriend: boolean;
  isOwn: boolean;
  source: "friends" | "public";
  createdAt: string;
};

export type FriendProfile = {
  userId: string;
  email: string;
  authorName: string;
  authorAvatarUrl: string | null;
  friendshipStatus: FriendshipStatus | "none" | "self";
};

export type PendingFriendship = {
  id: string;
  requesterId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  createdAt: string;
};
