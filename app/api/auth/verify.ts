import { AniListUser } from '@/lib/types';
import { Role } from '@/lib/permissions';
import { Role as PrismaRole } from '@prisma/client';

// Create a type alias for the Role
type RoleType = PrismaRole;

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
  
  // Determine role based on AniList status and special cases
  let role: RoleType = PrismaRole.USER;
  
  if (isSuperAdmin) {
    role = PrismaRole.SUPER_ADMIN;
  } else if (anilistUser.moderatorStatus === 'ADMIN') {
    role = PrismaRole.ADMIN;
  } else if (anilistUser.moderatorStatus === 'MODERATOR') {
    role = PrismaRole.MODERATOR;
  }

  // For backward compatibility, set boolean flags
  const isMod = role === PrismaRole.MODERATOR || role === PrismaRole.ADMIN || role === PrismaRole.SUPER_ADMIN;
  const isAdmin = role === PrismaRole.ADMIN || role === PrismaRole.SUPER_ADMIN;

  try {
    const user = await db.user.upsert({
      where: {
        anilist_user_id: anilistUser.id
      },
      update: {
        username: anilistUser.name,
        profile_picture_url: anilistUser.avatar?.large || anilistUser.avatar?.medium,
        role: role,
        is_mod: isMod,
        is_admin: isAdmin,
        last_active: new Date()
      },
      create: {
        anilist_user_id: anilistUser.id,
        username: anilistUser.name,
        profile_picture_url: anilistUser.avatar?.large || anilistUser.avatar?.medium,
        role: role,
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
