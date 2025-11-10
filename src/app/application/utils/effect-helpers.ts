import { Effect, Option, pipe } from "effect";

/**
 * Effect Helper Functions
 *
 * Common patterns for working with Effect in functional style.
 * These helpers promote composition and reduce boilerplate.
 */

/**
 * Load entity by ID or fail with NotFoundError
 *
 * @param findEffect - Effect that returns Option of entity
 * @param entityType - Type of entity for error message
 * @param id - ID of the entity
 * @returns Effect that succeeds with entity or fails with error
 *
 * @example
 * ```ts
 * const document = yield* loadEntity(
 *   repo.findById(documentId),
 *   "Document",
 *   documentId
 * );
 * ```
 */
export const loadEntity = <A, E>(
  findEffect: Effect.Effect<Option.Option<A>, E>,
  entityType: string,
  id: string
): Effect.Effect<
  A,
  | E
  | {
      readonly _tag: "NotFoundError";
      readonly entityType: string;
      readonly id: string;
      readonly message: string;
    }
> =>
  pipe(
    findEffect,
    Effect.flatMap(
      Option.match({
        onNone: () =>
          Effect.fail({
            _tag: "NotFoundError" as const,
            entityType,
            id,
            message: `${entityType} with ID ${id} not found`,
          }),
        onSome: Effect.succeed,
      })
    )
  );

/**
 * Load multiple entities in parallel
 *
 * @param effects - Record of Effects to run in parallel
 * @returns Effect that succeeds with all results or fails with first error
 *
 * @example
 * ```ts
 * const { document, user, permissions } = yield* loadEntities({
 *   document: loadEntity(repo.findById(docId), "Document", docId),
 *   user: loadEntity(userRepo.findById(userId), "User", userId),
 *   permissions: permissionRepo.findByDocument(docId),
 * });
 * ```
 */
export const loadEntities = <
  T extends Record<string, Effect.Effect<any, any, any>>
>(
  effects: T
  // Note: Effect.all has complex generic inference that TypeScript struggles with.
  // The return type maps each effect to its success value but is difficult to express precisely.
  // Runtime behavior is correct; this is a type system limitation.
) => Effect.all(effects) as any;

/**
 * Require Option to be Some, or fail with error
 *
 * @param option - Option value to check
 * @param error - Error to fail with if None
 * @returns Effect that succeeds with value or fails with error
 *
 * @example
 * ```ts
 * const version = yield* requireSome(
 *   Document.getLatestVersion(document),
 *   new NotFoundError({
 *     entityType: "DocumentVersion",
 *     id: documentId,
 *     message: "No versions found for document",
 *   })
 * );
 * ```
 */
export const requireSome = <A, E>(
  option: Option.Option<A>,
  error: E
): Effect.Effect<A, E> =>
  pipe(
    option,
    Option.match({
      onNone: () => Effect.fail(error),
      onSome: Effect.succeed,
    })
  );

/**
 * Convert Option to Effect, failing with custom error if None
 *
 * @param option - Option value
 * @param onNone - Function that returns error
 * @returns Effect that succeeds with value or fails with error
 *
 * @example
 * ```ts
 * const value = yield* fromOption(
 *   someOption,
 *   () => new CustomError({ message: "Value not found" })
 * );
 * ```
 */
export const fromOption = <A, E>(
  option: Option.Option<A>,
  onNone: () => E
): Effect.Effect<A, E> =>
  pipe(
    option,
    Option.match({
      onNone: () => Effect.fail(onNone()),
      onSome: Effect.succeed,
    })
  );

/**
 * Execute effect and transform the result
 * Convenient for chaining transformations
 *
 * @param effect - Effect to execute
 * @param fn - Transformation function
 * @returns Effect with transformed result
 */
export const andThen = <A, E, B>(
  effect: Effect.Effect<A, E>,
  fn: (a: A) => B
): Effect.Effect<B, E> => pipe(effect, Effect.map(fn));

/**
 * Execute effect and chain another effect based on result
 *
 * @param effect - Effect to execute
 * @param fn - Function that returns next Effect
 * @returns Effect chain
 */
export const andThenEffect = <A, E, B, E2>(
  effect: Effect.Effect<A, E>,
  fn: (a: A) => Effect.Effect<B, E2>
): Effect.Effect<B, E | E2> => pipe(effect, Effect.flatMap(fn));

/**
 * Tap into an Effect for side effects without changing the value
 * Useful for logging, auditing, etc.
 *
 * @param effect - Effect to tap into
 * @param fn - Side effect function
 * @returns Original effect with side effect
 */
export const tapEffect = <A, E, E2>(
  effect: Effect.Effect<A, E>,
  fn: (a: A) => Effect.Effect<any, E2>
): Effect.Effect<A, E | E2> => pipe(effect, Effect.tap(fn));

/**
 * Run effects in sequence, collecting all results
 * Fails on first error
 *
 * @param effects - Array of Effects to run
 * @returns Effect with array of results
 */
export const sequence = <A, E>(
  effects: readonly Effect.Effect<A, E>[]
): Effect.Effect<readonly A[], E> => Effect.all(effects, { concurrency: 1 });

/**
 * Run effects in parallel, collecting all results
 * Fails on first error
 *
 * @param effects - Array of Effects to run
 * @returns Effect with array of results
 */
export const parallel = <A, E>(
  effects: readonly Effect.Effect<A, E>[]
): Effect.Effect<readonly A[], E> => Effect.all(effects);

/**
 * Conditional Effect execution
 *
 * @param condition - Boolean condition
 * @param onTrue - Effect to run if true
 * @param onFalse - Effect to run if false
 * @returns Effect based on condition
 */
export const ifEffect = <A, E, B, E2>(
  condition: boolean,
  onTrue: () => Effect.Effect<A, E>,
  onFalse: () => Effect.Effect<B, E2>
): Effect.Effect<A | B, E | E2> => (condition ? onTrue() : onFalse());

/**
 * Filter array using Effect-based predicate
 *
 * @param array - Array to filter
 * @param predicate - Effect-based predicate
 * @returns Effect with filtered array
 */
export const filterEffect = <A, E>(
  array: readonly A[],
  predicate: (a: A) => Effect.Effect<boolean, E>
): Effect.Effect<readonly A[], E> =>
  pipe(
    array,
    Effect.forEach((item) =>
      pipe(
        predicate(item),
        Effect.map((keep) => (keep ? Option.some(item) : Option.none()))
      )
    ),
    Effect.map((options) =>
      options.filter(Option.isSome).map((opt) => opt.value)
    )
  );
