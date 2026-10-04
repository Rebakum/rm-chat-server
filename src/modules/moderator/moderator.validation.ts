import { z } from "zod";

const createModeratorSchema = z.object({
  body: z.object({
    email: z.string().email("Enter a valid email address"),
  }),
});

const inviteModeratorSchema = z.object({
  params: z.object({
    userId: z.string().min(1),
  }),
});

const tokenParamSchema = z.object({
  params: z.object({
    token: z.string().min(1),
  }),
});

const revokeModeratorSchema = z.object({
  params: z.object({
    userId: z.string().min(1),
  }),
});

const userIdParamSchema = z.object({
  params: z.object({
    userId: z.string().min(1),
  }),
});

const grantPermissionSchema = z.object({
  params: z.object({
    userId: z.string().min(1),
  }),
  body: z.object({
    permissionKey: z.string().min(1).max(100),
  }),
});

const revokePermissionSchema = z.object({
  params: z.object({
    userId: z.string().min(1),
  }),
  body: z.object({
    permissionKey: z.string().min(1).max(100),
  }),
});

const bulkPermissionsSchema = z.object({
  params: z.object({
    userId: z.string().min(1),
  }),
  body: z.object({
    permissions: z.array(z.string().min(1).max(100)),
  }),
});

const invitationIdParamSchema = z.object({
  params: z.object({
    invitationId: z.string().min(1),
  }),
});

export {
  createModeratorSchema,
  inviteModeratorSchema,
  tokenParamSchema,
  revokeModeratorSchema,
  userIdParamSchema,
  grantPermissionSchema,
  revokePermissionSchema,
  bulkPermissionsSchema,
  invitationIdParamSchema,
};
