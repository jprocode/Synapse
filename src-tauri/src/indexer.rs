use pulldown_cmark::{Event, Parser, Tag, TagEnd};
use std::collections::HashSet;

/// Extracted metadata from a markdown file
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct NoteIndex {
    /// Relative path of the note in the vault
    pub path: String,
    /// Note title (from frontmatter or first heading or filename)
    pub title: String,
    /// All outgoing wikilinks: [[Target Note]]
    pub outgoing_links: Vec<String>,
    /// All tags found in the note (#tag, #nested/tag) + frontmatter tags
    pub tags: Vec<String>,
    /// All headings in the note (for outline + section links)
    pub headings: Vec<Heading>,
    /// Word count of the body
    pub word_count: usize,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Heading {
    pub text: String,
    pub level: u8,
    /// Line number (1-based) where this heading appears
    pub line: usize,
}

/// Extract all wikilinks from markdown content
/// Matches [[Target]], [[Target|Alias]], [[Target#Heading]], [[Target^blockid]]
pub fn extract_wikilinks(content: &str) -> Vec<String> {
    let mut links = Vec::new();
    let mut chars = content.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '[' {
            if chars.peek() == Some(&'[') {
                chars.next(); // consume second [
                let mut link_text = String::new();
                let mut depth = 1;

                for c2 in chars.by_ref() {
                    if c2 == ']' {
                        depth -= 1;
                        if depth == 0 {
                            // Consume the second ]
                            chars.next();
                            break;
                        }
                    } else if c2 == '[' {
                        depth += 1;
                    } else {
                        link_text.push(c2);
                    }
                }

                if !link_text.is_empty() {
                    // Extract just the note name (before | # or ^)
                    let note_name = link_text
                        .split('|')
                        .next()
                        .unwrap_or(&link_text)
                        .split('#')
                        .next()
                        .unwrap_or(&link_text)
                        .split('^')
                        .next()
                        .unwrap_or(&link_text)
                        .trim()
                        .to_string();

                    if !note_name.is_empty() {
                        links.push(note_name);
                    }
                }
            }
        }
    }

    links
}

/// Extract all tags from markdown content (#tag, #nested/tag)
pub fn extract_tags(content: &str) -> Vec<String> {
    let mut tags = HashSet::new();

    // Match #tag patterns (not inside code blocks or URLs)
    let mut in_code_block = false;
    let mut in_inline_code = false;

    for line in content.lines() {
        let trimmed = line.trim();

        // Toggle code block state
        if trimmed.starts_with("```") {
            in_code_block = !in_code_block;
            continue;
        }
        if in_code_block {
            continue;
        }

        // Scan for tags in this line
        let chars: Vec<char> = line.chars().collect();
        let len = chars.len();
        let mut i = 0;

        while i < len {
            // Track inline code
            if chars[i] == '`' {
                in_inline_code = !in_inline_code;
                i += 1;
                continue;
            }
            if in_inline_code {
                i += 1;
                continue;
            }

            // Check for # preceded by whitespace or start of line
            if chars[i] == '#' {
                let prev_is_boundary =
                    i == 0 || chars[i - 1].is_whitespace() || chars[i - 1] == ',';

                if prev_is_boundary {
                    // Check it's not a heading (# followed by space at start of line)
                    if i == 0 && i + 1 < len && chars[i + 1] == ' ' {
                        i += 1;
                        continue;
                    }

                    // Collect tag characters
                    let start = i;
                    i += 1;
                    while i < len
                        && (chars[i].is_alphanumeric()
                            || chars[i] == '-'
                            || chars[i] == '_'
                            || chars[i] == '/')
                    {
                        i += 1;
                    }

                    let tag = chars[start..i].iter().collect::<String>();
                    if tag.len() > 1 {
                        // Must have at least one char after #
                        tags.insert(tag);
                    }
                    continue;
                }
            }

            i += 1;
        }
    }

    tags.into_iter().collect()
}

/// Extract all headings from markdown content
pub fn extract_headings(content: &str) -> Vec<Heading> {
    let mut headings = Vec::new();

    // Count line numbers
    for (line_num, line) in content.lines().enumerate() {
        let trimmed = line.trim_start();
        if trimmed.starts_with('#') {
            let level = trimmed.chars().take_while(|c| *c == '#').count();
            if level >= 1 && level <= 6 {
                let text = trimmed[level..].trim().to_string();
                if !text.is_empty() {
                    headings.push(Heading {
                        text,
                        level: level as u8,
                        line: line_num + 1,
                    });
                }
            }
        }
    }

    headings
}

/// Count words in markdown content (excluding frontmatter and code blocks)
pub fn count_words(content: &str) -> usize {
    let body = crate::vault::Vault::strip_frontmatter(content);
    let mut count = 0;
    let mut in_code_block = false;

    for line in body.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("```") {
            in_code_block = !in_code_block;
            continue;
        }
        if in_code_block {
            continue;
        }
        count += trimmed.split_whitespace().count();
    }

    count
}

/// Build a complete index for a note
pub fn index_note(path: &str, content: &str, frontmatter_tags: &[String]) -> NoteIndex {
    let mut tags = extract_tags(content);
    // Merge frontmatter tags (add # prefix if not present)
    for ft in frontmatter_tags {
        let tag = if ft.starts_with('#') {
            ft.clone()
        } else {
            format!("#{}", ft)
        };
        if !tags.contains(&tag) {
            tags.push(tag);
        }
    }

    let headings = extract_headings(content);

    // Title: first heading, or filename without extension
    let title = headings
        .first()
        .map(|h| h.text.clone())
        .unwrap_or_else(|| {
            std::path::Path::new(path)
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string()
        });

    NoteIndex {
        path: path.to_string(),
        title,
        outgoing_links: extract_wikilinks(content),
        tags,
        headings,
        word_count: count_words(content),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_wikilinks() {
        let content = "Hello [[World]] and [[Another Note|alias]] stuff [[Note#Heading]]";
        let links = extract_wikilinks(content);
        assert_eq!(links, vec!["World", "Another Note", "Note"]);
    }

    #[test]
    fn test_extract_tags() {
        let content = "This has #tag1 and #nested/tag and #multi-word\nNo #heading here";
        let tags = extract_tags(content);
        assert!(tags.contains(&"#tag1".to_string()));
        assert!(tags.contains(&"#nested/tag".to_string()));
        assert!(tags.contains(&"#multi-word".to_string()));
    }

    #[test]
    fn test_extract_headings() {
        let content = "# Title\n## Section\n### Subsection\nRegular text";
        let headings = extract_headings(content);
        assert_eq!(headings.len(), 3);
        assert_eq!(headings[0].level, 1);
        assert_eq!(headings[0].text, "Title");
    }
}
