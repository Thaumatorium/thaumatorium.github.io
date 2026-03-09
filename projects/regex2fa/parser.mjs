export const REGEX_OPERATORS = ["|", "*", "+", "?", "(", ")"];
export const CONCAT_OPERATOR = "·";

export function tokenizeRegex(regex) {
	const tokens = [];
	let index = 0;
	while (index < regex.length) {
		const char = regex[index];
		if (char === "[") {
			let classContent = "";
			let depth = 1;
			index++;
			while (index < regex.length) {
				if (regex[index] === "\\" && index + 1 < regex.length) {
					classContent += regex[index] + regex[index + 1];
					index += 2;
					continue;
				}
				if (regex[index] === "]") {
					depth--;
					if (depth === 0) break;
				} else if (regex[index] === "[") {
					depth++;
				}
				classContent += regex[index];
				index++;
			}
			if (depth !== 0 || index >= regex.length || regex[index] !== "]") {
				throw new Error(`Unterminated or malformed character class starting with: [${classContent.slice(0, 10)}`);
			}
			tokens.push(`[${classContent}]`);
			index++;
			continue;
		}
		if (char === "\\" && index + 1 < regex.length) {
			tokens.push(char + regex[index + 1]);
			index += 2;
			continue;
		}
		if (REGEX_OPERATORS.includes(char)) {
			tokens.push(char);
			index++;
			continue;
		}
		tokens.push(char);
		index++;
	}
	return tokens;
}

export function addExplicitConcat(tokens) {
	const result = [];
	for (let index = 0; index < tokens.length; index++) {
		const current = tokens[index];
		result.push(current);
		if (index === tokens.length - 1) continue;
		const next = tokens[index + 1];
		const currentCanPrecede = current === ")" || current === "*" || current === "+" || current === "?" || isOperand(current);
		const nextCanFollow = next === "(" || isOperand(next);
		if (currentCanPrecede && nextCanFollow) {
			result.push(CONCAT_OPERATOR);
		}
	}
	return result;
}

export function infixToPostfix(tokensWithConcat) {
	const precedence = { "|": 1, [CONCAT_OPERATOR]: 2, "?": 3, "*": 3, "+": 3 };
	const output = [];
	const operatorStack = [];
	for (const token of tokensWithConcat) {
		if (isOperand(token)) {
			output.push(token);
			continue;
		}
		if (token === "(") {
			operatorStack.push(token);
			continue;
		}
		if (token === ")") {
			while (operatorStack.length && operatorStack[operatorStack.length - 1] !== "(") {
				output.push(operatorStack.pop());
			}
			if (operatorStack.length === 0) {
				throw new Error("Mismatched parentheses");
			}
			operatorStack.pop();
			continue;
		}
		while (operatorStack.length && operatorStack[operatorStack.length - 1] !== "(" && precedence[operatorStack[operatorStack.length - 1]] >= precedence[token]) {
			output.push(operatorStack.pop());
		}
		operatorStack.push(token);
	}
	while (operatorStack.length) {
		const op = operatorStack.pop();
		if (op === "(") {
			throw new Error("Mismatched parentheses");
		}
		output.push(op);
	}
	return output;
}

export function isOperand(token) {
	return (token.startsWith("[") && token.endsWith("]")) || (token.length === 2 && token[0] === "\\") || (!REGEX_OPERATORS.includes(token) && token !== CONCAT_OPERATOR);
}
