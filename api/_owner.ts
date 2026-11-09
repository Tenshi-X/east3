import { queryOne } from "./_db";

export async function isAtlasOwner(user: {
  id: string;
  email: string;
}): Promise<boolean> {
  const ownerId = process.env.ATLAS_OWNER_USER_ID?.trim();
  const ownerEmail = process.env.ATLAS_OWNER_EMAIL?.trim().toLowerCase();
  if (ownerId) return user.id === ownerId;
  if (ownerEmail) return user.email.toLowerCase() === ownerEmail;
  const owner = await queryOne<{ user_id: string }>(
    "SELECT user_id FROM atlas_owner WHERE singleton = TRUE",
  );
  return owner?.user_id === user.id;
}
