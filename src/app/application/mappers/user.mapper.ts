/**
 * User Application → Domain Mappers
 *
 * Maps Application DTOs to Domain entities for user operations.
 */

import type {
  RegisterUserCommand,
  LoginUserCommand,
  UpdateUserProfileCommand,
} from "../dtos/user/request.dto";
import type {
  UserResponse,
  LoginResponse,
  RegisterResponse,
  UserProfileResponse,
  ListUsersResponse,
} from "../dtos/user/response.dto";
import type {
  UserEntity as User,
  UserPublicEntity as UserPublic,
} from "../../domain/user/entity";
import type { EmailAddress } from "../../domain/refined/email";
import type { HashedPassword } from "../../domain/refined/password";
import type { UserRole } from "../../domain/user/value-object";

/**
 * Command to Domain Mappers
 */
export const UserCommandMapper = {
  /**
   * Map RegisterUserCommand to User.create parameters
   */
  toCreateParams: (
    command: RegisterUserCommand,
    hashedPassword: HashedPassword
  ): {
    email: EmailAddress;
    password: HashedPassword;
    role?: UserRole;
  } => ({
    email: command.email,
    password: hashedPassword,
    role: command.role,
  }),

  /**
   * Map UpdateUserProfileCommand to User.update parameters
   */
  toUpdateParams: (
    command: UpdateUserProfileCommand,
    hashedPassword?: HashedPassword
  ): {
    email?: EmailAddress;
    password?: HashedPassword;
    role?: UserRole;
  } => ({
    email: command.email,
    password: hashedPassword,
    // Note: role cannot be updated via profile update
  }),
} as const;

/**
 * Domain to Response Mappers
 */
export const UserResponseMapper = {
  /**
   * Map User entity to UserResponse DTO
   * Excludes password field
   */
  toUserResponse: (user: User | UserPublic): UserResponse => ({
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt as any, // Branded Date type
    updatedAt: user.updatedAt as any, // Branded Date type
  }),

  /**
   * Map User and token to LoginResponse DTO
   */
  toLoginResponse: (
    user: User,
    token: string,
    expiresIn: number
  ): LoginResponse => ({
    user: UserResponseMapper.toUserResponse(user),
    token,
    expiresIn,
  }),

  /**
   * Map User to RegisterResponse DTO
   */
  toRegisterResponse: (user: User): RegisterResponse => ({
    user: UserResponseMapper.toUserResponse(user),
  }),

  /**
   * Map User to UserProfileResponse DTO
   */
  toUserProfileResponse: (user: User): UserProfileResponse =>
    UserResponseMapper.toUserResponse(user),

  /**
   * Map paginated users to ListUsersResponse DTO
   */
  toListUsersResponse: (
    users: readonly User[],
    total: number,
    page: number,
    limit: number
  ): ListUsersResponse => ({
    users: users.map(UserResponseMapper.toUserResponse),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }),
} as const;
