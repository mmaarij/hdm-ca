/**
 * Application Ports (Hexagonal Architecture)
 *
 * Ports define the abstract interfaces required by the application layer.
 * They are implemented by adapters in the infrastructure layer.
 *
 * This enables:
 * - Dependency Inversion: Application depends on abstractions
 * - Testability: Easy to mock ports for testing
 * - Clean Architecture: Domain/application layers remain pure
 */

export * from "./storage.port";
export * from "./password-hasher.port";
export * from "./jwt.port";
