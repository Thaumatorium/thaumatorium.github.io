from dataclasses import dataclass
from typing import Any, Callable, Protocol, TypeVar, Generic


class Catalog:
    pass


class DomainProtocol(Protocol):
    name: str


@dataclass
class Domain:
    name: str

    def __init__(self, name: str) -> None:
        self.name = name

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(name={self.name!r})"


class PartId(Domain):
    value: int

    def __init__(self, value: Any) -> None:
        super().__init__("PartId")
        if isinstance(value, int) and value >= 0:
            self.value = value

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(value={self.value!r})"


class PartName(Domain):
    value: str

    def __init__(self, value: Any) -> None:
        super().__init__("PartName")
        if isinstance(value, str) and len(value) > 0:
            self.value = value

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(value={self.value!r})"


class PartDescription(Domain):
    value: str

    def __init__(self, value: Any) -> None:
        super().__init__("PartDescription")
        if isinstance(value, str):
            self.value = value

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(value={self.value!r})"


class QuantityOnHand(Domain):
    value: int

    def __init__(self, value: Any) -> None:
        super().__init__("QuantityOnHand")
        if isinstance(value, int) and value >= 0:
            self.value = value

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(value={self.value!r})"


class QuantityOnOrder(Domain):
    value: int

    def __init__(self, value: Any) -> None:
        super().__init__("QuantityOnOrder")
        if isinstance(value, int) and value >= 0:
            self.value = value

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(value={self.value!r})"


class BusinessRule(Protocol):
    def is_satisfied(self, row: tuple[Domain, ...]) -> bool:
        ...


class QuantityConsistencyRule:
    def is_satisfied(self, row: tuple[Domain, ...]) -> bool:
        quantity_on_hand = next((x.value for x in row if isinstance(x, QuantityOnHand)), None)
        quantity_on_order = next((x.value for x in row if isinstance(x, QuantityOnOrder)), None)
        if quantity_on_hand is not None and quantity_on_order is not None:
            return quantity_on_hand >= 0 and quantity_on_order >= 0
        return True


T = TypeVar("T", bound=DomainProtocol)


class Relation(Generic[T]):
    domains: list[type[T]]
    data: set[tuple[T, ...]]
    rules: list[BusinessRule]

    def __init__(self, internal_data: list[type[T]], rules: list[BusinessRule] = None) -> None:
        self.domains = internal_data
        self.data = set()
        self.rules = rules or []

    def add(self, row: tuple[T, ...]) -> "Relation[T]":
        if len(self.domains) != len(row):
            print("Input must be of same size as relation")
            return self
        for domain_type, value in zip(self.domains, row):
            if not isinstance(value, domain_type):
                print("Input must be of same type as relation")
                return self
        if all(rule.is_satisfied(row) for rule in self.rules):
            self.data.add(row)
        else:
            print("Row does not satisfy business rules")
        return self

    def filter(self, fn: Callable[[tuple[T, ...]], bool]) -> "Relation[T]":
        result = Relation(self.domains, self.rules)
        result.data = {row for row in self.data if fn(row)}
        return result

    def project(self, fn: Callable[[list[type[T]]], list[type[T]]]) -> "Relation[T]":
        projected_domains = fn(self.domains)
        result = Relation(projected_domains, self.rules)
        result.data = {tuple(fn(list(row))) for row in self.data}
        return result

    def join(self, other: "Relation[T]") -> "Relation[T]":
        joined_domains = self.domains + other.domains
        result = Relation(joined_domains, self.rules + other.rules)
        for row1 in self.data:
            for row2 in other.data:
                result.add(row1 + row2)
        return result

    def merge(self, other: "Relation[T]") -> "Relation[T]":
        if self.domains != other.domains:
            print("Relations must have the same domains to merge")
            return self
        result = Relation(self.domains, self.rules)
        result.data = self.data.union(other.data)
        return result

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(domains={self.domains!r}, data={self.data!r})"
        )


quantity_consistency_rule = QuantityConsistencyRule()
parts = Relation([PartId, PartName, PartDescription, QuantityOnHand, QuantityOnOrder], [quantity_consistency_rule])
project = Relation([])

# Example usage
part_row = (PartId(1), PartName("Widget"), PartDescription("A useful widget"), QuantityOnHand(10), QuantityOnOrder(5))
parts.add(part_row)

part_row_invalid = (PartId(2), PartName("Gadget"), PartDescription("A fancy gadget"), QuantityOnHand(-5), QuantityOnOrder(3))
parts.add(part_row_invalid)

print(parts)
