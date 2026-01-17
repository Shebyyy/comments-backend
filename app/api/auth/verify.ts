import { AniListUser } from '@/lib/types';
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
  // Check if this is the hardcoded super admin user (ASheby - 5724017)
  const isSuperAdminHardcoded = anilistUser.id === 5724017;
  
  // Fetch existing user from database to see if they have a manually assigned role
  const existingUser = await db.user.findUnique({
    where: { anilist_user_id: anilistUser.id }
  });

  // Determine role priority:
  // 1. Hardcoded Super Admin
  // 2. Existing DB Role (if it's not 'USER', we trust our DB over AniList)
  // 3. AniList moderatorStatus fallback
  
  let role: RoleType = PrismaRole.USER;
  
  if (isSuperAdminHardcoded) {
    role = PrismaRole.SUPER_ADMIN;
  } else if (existingUser && existingUser.role !== PrismaRole.USER) {
    // If the database already has them as ADMIN/MODERATOR, keep it!
    role = existingUser.role;
  } else if (anilistUser.moderatorStatus === 'ADMIN') {
    role = PrismaRole.ADMIN;
  } else if (anilistUser.moderatorStatus === 'MODERATOR') {
    role = PrismaRole.MODERATOR;
  }

  // Set boolean flags for backward compatibility based on the resolved role
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
