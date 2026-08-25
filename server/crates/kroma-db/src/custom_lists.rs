//! Custom named lists: user-created collections of titles.

use anyhow::Result;
use rusqlite::params;

use crate::now_or_blank;
use crate::pool::Pool;

#[derive(Debug, Clone, serde::Serialize)]
pub struct CustomList {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct CustomListEntry {
    pub item_id: String,
    pub note: Option<String>,
    pub position: Option<i64>,
    pub added_at: String,
}

pub fn create_list(pool: &Pool, user_id: &str, name: &str, icon: Option<&str>) -> Result<CustomList> {
    let conn = pool.get()?;
    let id = kroma_primitives::random_token();
    let now = now_or_blank();
    let sort_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM custom_lists WHERE user_id = ?1",
        params![user_id],
        |r| r.get(0),
    )?;
    conn.execute(
        "INSERT INTO custom_lists (id, user_id, name, icon, sort_order, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, user_id, name, icon, sort_order, now],
    )?;
    Ok(CustomList { id, name: name.to_string(), icon: icon.map(String::from), sort_order, created_at: now })
}

pub fn rename_list(pool: &Pool, user_id: &str, list_id: &str, name: &str) -> Result<()> {
    let conn = pool.get()?;
    let n = conn.execute(
        "UPDATE custom_lists SET name = ?1 WHERE id = ?2 AND user_id = ?3",
        params![name, list_id, user_id],
    )?;
    if n == 0 {
        anyhow::bail!("list not found");
    }
    Ok(())
}

pub fn delete_list(pool: &Pool, user_id: &str, list_id: &str) -> Result<()> {
    let conn = pool.get()?;
    let n = conn.execute(
        "DELETE FROM custom_lists WHERE id = ?1 AND user_id = ?2",
        params![list_id, user_id],
    )?;
    if n == 0 {
        anyhow::bail!("list not found");
    }
    Ok(())
}

pub fn reorder_list(pool: &Pool, user_id: &str, list_id: &str, new_order: i64) -> Result<()> {
    let conn = pool.get()?;
    let n = conn.execute(
        "UPDATE custom_lists SET sort_order = ?1 WHERE id = ?2 AND user_id = ?3",
        params![new_order, list_id, user_id],
    )?;
    if n == 0 {
        anyhow::bail!("list not found");
    }
    Ok(())
}

pub fn list_custom_lists(pool: &Pool, user_id: &str) -> Result<Vec<CustomList>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT id, name, icon, sort_order, created_at FROM custom_lists WHERE user_id = ?1 ORDER BY sort_order",
    )?;
    let rows = stmt.query_map(params![user_id], |r| {
        Ok(CustomList {
            id: r.get(0)?,
            name: r.get(1)?,
            icon: r.get(2)?,
            sort_order: r.get(3)?,
            created_at: r.get(4)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn add_to_custom_list(pool: &Pool, list_id: &str, item_id: &str) -> Result<()> {
    let conn = pool.get()?;
    conn.execute(
        "INSERT INTO custom_list_entries (list_id, item_id, added_at) VALUES (?1, ?2, ?3) \
         ON CONFLICT(list_id, item_id) DO UPDATE SET added_at=excluded.added_at",
        params![list_id, item_id, now_or_blank()],
    )?;
    Ok(())
}

pub fn set_entry_note(pool: &Pool, list_id: &str, item_id: &str, note: Option<&str>) -> Result<()> {
    let conn = pool.get()?;
    let n = conn.execute(
        "UPDATE custom_list_entries SET note = ?1 WHERE list_id = ?2 AND item_id = ?3",
        params![note, list_id, item_id],
    )?;
    if n == 0 {
        anyhow::bail!("entry not found");
    }
    Ok(())
}

pub fn remove_from_custom_list(pool: &Pool, list_id: &str, item_id: &str) -> Result<()> {
    let conn = pool.get()?;
    conn.execute(
        "DELETE FROM custom_list_entries WHERE list_id = ?1 AND item_id = ?2",
        params![list_id, item_id],
    )?;
    Ok(())
}

pub fn list_custom_list_entries(pool: &Pool, list_id: &str) -> Result<Vec<CustomListEntry>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT item_id, note, position, added_at FROM custom_list_entries \
         WHERE list_id = ?1 ORDER BY position IS NULL, position ASC, added_at DESC",
    )?;
    let rows = stmt.query_map(params![list_id], |r| {
        Ok(CustomListEntry {
            item_id: r.get(0)?,
            note: r.get(1)?,
            position: r.get(2)?,
            added_at: r.get(3)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Sets positions for all entries in a list, persisting a user-defined order.
pub fn reorder_custom_list_entries(
    pool: &Pool,
    list_id: &str,
    item_ids: &[String],
) -> Result<()> {
    let mut conn = pool.get()?;
    let tx = conn.transaction()?;
    for (i, item_id) in item_ids.iter().enumerate() {
        tx.execute(
            "UPDATE custom_list_entries SET position = ?1 WHERE list_id = ?2 AND item_id = ?3",
            params![i as i64, list_id, item_id],
        )?;
    }
    tx.commit()?;
    Ok(())
}

/// Every custom list id+name that contains this item, for the given user.
pub fn lists_containing_item(pool: &Pool, user_id: &str, item_id: &str) -> Result<Vec<(String, String)>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT cl.id, cl.name FROM custom_lists cl \
         JOIN custom_list_entries cle ON cle.list_id = cl.id \
         WHERE cl.user_id = ?1 AND cle.item_id = ?2 ORDER BY cl.sort_order",
    )?;
    let rows = stmt.query_map(params![user_id, item_id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::temp_pool;
    use kroma_domain::Permission;

    fn pool_with_user() -> (crate::testing::TempPool, String) {
        let pool = temp_pool("custom_lists");
        let user = crate::create_user(&pool, "w@e.com", "w", "hash", &[Permission::Playback]).unwrap();
        (pool, user.id)
    }

    #[test]
    fn create_list_and_add_items() {
        let (pool, uid) = pool_with_user();
        let list = create_list(&pool, &uid, "Friday Night", None).unwrap();
        assert_eq!(list.name, "Friday Night");
        assert_eq!(list.sort_order, 0);

        let list2 = create_list(&pool, &uid, "Sci-Fi", Some("rocket")).unwrap();
        assert_eq!(list2.sort_order, 1);
        assert_eq!(list2.icon.as_deref(), Some("rocket"));

        let lists = list_custom_lists(&pool, &uid).unwrap();
        assert_eq!(lists.len(), 2);
        assert_eq!(lists[0].name, "Friday Night");

        add_to_custom_list(&pool, &list.id, "m1").unwrap();
        add_to_custom_list(&pool, &list.id, "show-7").unwrap();
        add_to_custom_list(&pool, &list.id, "m1").unwrap(); // idempotent
        let entries = list_custom_list_entries(&pool, &list.id).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].item_id, "m1");

        set_entry_note(&pool, &list.id, "m1", Some("Great movie")).unwrap();
        let entries = list_custom_list_entries(&pool, &list.id).unwrap();
        let m1 = entries.iter().find(|e| e.item_id == "m1").unwrap();
        assert_eq!(m1.note.as_deref(), Some("Great movie"));

        let containing = lists_containing_item(&pool, &uid, "m1").unwrap();
        assert_eq!(containing.len(), 1);
        assert_eq!(containing[0].1, "Friday Night");

        remove_from_custom_list(&pool, &list.id, "m1").unwrap();
        assert_eq!(list_custom_list_entries(&pool, &list.id).unwrap().len(), 1);
    }

    #[test]
    fn rename_and_delete_list() {
        let (pool, uid) = pool_with_user();
        let list = create_list(&pool, &uid, "Old Name", None).unwrap();

        rename_list(&pool, &uid, &list.id, "New Name").unwrap();
        let lists = list_custom_lists(&pool, &uid).unwrap();
        assert_eq!(lists[0].name, "New Name");

        // Rename a non-existent list fails.
        assert!(rename_list(&pool, &uid, "nope", "X").is_err());

        delete_list(&pool, &uid, &list.id).unwrap();
        assert!(list_custom_lists(&pool, &uid).unwrap().is_empty());

        // Deleting a non-existent list fails.
        assert!(delete_list(&pool, &uid, "nope").is_err());
    }

    #[test]
    fn other_user_cannot_see_or_modify() {
        let (pool, uid) = pool_with_user();
        let list = create_list(&pool, &uid, "Private", None).unwrap();

        // A different user's lists are empty.
        let other = crate::create_user(&pool, "other@e.com", "other", "h", &[Permission::Playback]).unwrap();
        assert!(list_custom_lists(&pool, &other.id).unwrap().is_empty());

        // Other user cannot rename or delete.
        assert!(rename_list(&pool, &other.id, &list.id, "Hacked").is_err());
        assert!(delete_list(&pool, &other.id, &list.id).is_err());
    }

    #[test]
    fn reorder_entries_persists_position() {
        let (pool, uid) = pool_with_user();
        let list = create_list(&pool, &uid, "Ordered", None).unwrap();
        add_to_custom_list(&pool, &list.id, "m1").unwrap();
        add_to_custom_list(&pool, &list.id, "m2").unwrap();
        add_to_custom_list(&pool, &list.id, "m3").unwrap();

        // Before reorder: all positions NULL, ordered by added_at DESC → m3, m2, m1.
        let before = list_custom_list_entries(&pool, &list.id).unwrap();
        assert_eq!(before[0].item_id, "m3");
        assert_eq!(before[2].item_id, "m1");

        // Persist a custom order: m1, m2, m3.
        reorder_custom_list_entries(&pool, &list.id, &["m1".into(), "m2".into(), "m3".into()]).unwrap();
        let after = list_custom_list_entries(&pool, &list.id).unwrap();
        assert_eq!(after[0].item_id, "m1");
        assert_eq!(after[1].item_id, "m2");
        assert_eq!(after[2].item_id, "m3");
    }
}
