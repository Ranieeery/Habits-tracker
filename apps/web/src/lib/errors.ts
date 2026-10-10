import { ApiClientError } from "@habits/api-client";

const MESSAGES: Record<string, string> = {
	validation_error: "Alguns dados estão inválidos. Confira e tente de novo.",
	date_out_of_range: "Essa data não pode mais ser alterada.",
	not_found: "Não encontramos o que você procurava.",
	unauthorized: "Sua sessão expirou. Entre novamente.",
	forbidden: "Você não tem permissão para isso.",
	rate_limited: "Muitas tentativas. Aguarde um pouco e tente de novo.",
	conflict: "Houve um conflito com outra alteração. Tente de novo.",
};

/** A pt-BR message for any error thrown by the API client or fetch. */
export function errorMessage(error: unknown): string {
	if (error instanceof ApiClientError) {
		return (
			MESSAGES[error.code] ?? "Algo deu errado no servidor. Tente de novo."
		);
	}
	if (error instanceof TypeError) {
		return "Sem conexão com o servidor. Verifique sua internet.";
	}
	return "Algo deu errado. Tente de novo.";
}
