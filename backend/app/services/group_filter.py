from sqlalchemy import or_
from sqlalchemy.orm import Query
from sqlalchemy.sql.elements import ColumnElement

UNGROUPED_GROUP_ID = 0


def parse_group_ids(group_ids: list[int] | None) -> list[int] | None:
    if not group_ids:
        return None
    return group_ids


def apply_group_ids_filter(
    query: Query,
    column: ColumnElement,
    group_id: int | None,
    group_ids: list[int] | None,
) -> Query:
    parsed = parse_group_ids(group_ids)
    if parsed is not None:
        has_ungrouped = UNGROUPED_GROUP_ID in parsed
        real_ids = [gid for gid in parsed if gid != UNGROUPED_GROUP_ID]
        conditions = []
        if real_ids:
            conditions.append(column.in_(real_ids))
        if has_ungrouped:
            conditions.append(column.is_(None))
        if conditions:
            return query.filter(or_(*conditions))
        return query.filter(column.in_([]))
    if group_id is not None:
        return query.filter(column == group_id)
    return query
