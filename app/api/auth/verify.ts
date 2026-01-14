import { AniListUser } from '@/lib/types';

export async function verifyAniListToken(token: string): Promise<AniListUser> {
  if (!token) {
    throw new Error('No token provided');
  }

  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AnymeX-Comments'
      },
      body: JSON.stringify({
        query: `
          query {
            Viewer {
              id
              name
              avatar {
                large
                medium
              }
              moderatorStatus
            }
          }
        `
      })
    });

    if (!response.ok) {
      throw new Error(`AniList API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`AniList GraphQL error: ${data.errors[0].message}`);
    }

    const user = data.data.Viewer;
    if (!user || !user.id) {
      throw new Error('Invalid user data from AniList');
    }

    return {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      moderatorStatus: user.moderatorStatus
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    throw new Error('Invalid or expired AniList token');
  }
}

export async function upsertUser(anilistUser: AniListUser, db: any) {
  // Check if this is the super admin user (ASheby - 5724017)
  const isSuperAdmin = anilistUser.id === 5724017;
  
  // For super admin, always grant both mod and admin regardless of AniList status
  // For others, use AniList moderator status
  const isMod = isSuperAdmin || anilistUser.moderatorStatus === 'MODERATOR' || anilistUser.moderatorStatus === 'ADMIN';
  const isAdmin = isSuperAdmin || anilistUser.moderatorStatus === 'ADMIN';

  try {
    const user = await db.user.upsert({
      where: {
        anilist_user_id: anilistUser.id
      },
      update: {
        username: anilistUser.name,
        profile_picture_url: anilistUser.avatar?.large || anilistUser.avatar?.medium,
        is_mod: isMod,
        is_admin: isAdmin,
        last_active: new Date()
      },
      create: {
        anilist_user_id: anilistUser.id,
        username: anilistUser.name,
        profile_picture_url: anilistUser.avatar?.large || anilistUser.avatar?.medium,
        is_mod: isMod,
        is_admin: isAdmin,
        last_active: new Date()
      }
    });

    return user;
  } catch (error) {
    console.error('User upsert failed:', error);
    throw error;
  }
}
