// Lightweight global utility types to help with optional/nullable ergonomics
declare global {
  type Maybe<T> = T | null | undefined;
  type Nullable<T> = T | null;
  type Undefinable<T> = T | undefined;
  type Opt<T> = T | undefined;
}

export {};
