// Errors as the screens see them: what went wrong, not how it was fetched.
// Phase 7 (local SQLite) reports the same kinds.
import { ApiClientError } from "@habits/api-client";

export type DataErrorKind =
	| "unauthorized"
	| "offline"
	| "invalid"
	| "not_found"
	/** The data does not allow it now (2.11.0: deleting a habit not archived). */
	| "conflict"
	| "out_of_range"
	| "rate_limited"
	| "unknown";

export class DataError extends Error {
	readonly kind: DataErrorKind;

	constructor(kind: DataErrorKind, message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "DataError";
		this.kind = kind;
	}
}

const KIND_BY_CODE: Record<string, DataErrorKind> = {
	unauthorized: "unauthorized",
	validation_error: "invalid",
	not_found: "not_found",
	date_out_of_range: "out_of_range",
	rate_limited: "rate_limited",
};

/** Maps anything thrown by the API client or `fetch` to a `DataError`. */
export function toDataError(error: unknown): DataError {
	if (error instanceof DataError) return error;
	if (error instanceof ApiClientError) {
		const kind =
			error.status === 401
				? "unauthorized"
				: (KIND_BY_CODE[error.code] ?? "unknown");
		return new DataError(kind, error.message, { cause: error });
	}
	// `fetch` rejects with a TypeError when the server cannot be reached.
	if (error instanceof TypeError) {
		return new DataError("offline", "Network request failed", {
			cause: error,
		});
	}
	return new DataError("unknown", "Unexpected error", { cause: error });
}

export function isUnauthorized(error: unknown): boolean {
	return error instanceof DataError && error.kind === "unauthorized";
}

const MESSAGES: Record<DataErrorKind, string> = {
	unauthorized: "Sua sessão expirou. Entre novamente.",
	offline: "Sem conexão com o servidor. Verifique sua internet.",
	invalid: "Alguns dados estão inválidos. Confira e tente de novo.",
	not_found: "Não encontramos o que você procurava.",
	conflict: "Só dá para apagar um hábito arquivado.",
	out_of_range: "Essa data não pode mais ser alterada.",
	rate_limited: "Muitas tentativas. Aguarde um pouco e tente de novo.",
	unknown: "Algo deu errado. Tente de novo.",
};

/** A pt-BR message for any error a data hook can surface. */
export function errorMessage(error: unknown): string {
	return MESSAGES[toDataError(error).kind];
}
