using System.Text.Json.Serialization;

namespace YiKe.Desktop.Models;

public sealed class TokenResponse
{
    [JsonPropertyName("access_token")]
    public string AccessToken { get; set; } = string.Empty;
}

public sealed class UserInfo
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Nickname { get; set; } = string.Empty;
    public string Avatar { get; set; } = string.Empty;
}

public sealed class GroupInfo
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
}

public sealed class ReviewWord
{
    public int Id { get; set; }
    public string Word { get; set; } = string.Empty;
    public string Phonetic { get; set; } = string.Empty;
    public string Pos { get; set; } = string.Empty;
    public string Meaning { get; set; } = string.Empty;
    public string Example { get; set; } = string.Empty;

    [JsonPropertyName("example_translation")]
    public string ExampleTranslation { get; set; } = string.Empty;

    [JsonPropertyName("group_id")]
    public int? GroupId { get; set; }

    [JsonPropertyName("due_date")]
    public string DueDate { get; set; } = string.Empty;

    [JsonPropertyName("overdue_days")]
    public int OverdueDays { get; set; }

    [JsonPropertyName("spell_stage_index")]
    public int SpellStageIndex { get; set; }

    [JsonPropertyName("rec_stage_index")]
    public int RecStageIndex { get; set; }
}
