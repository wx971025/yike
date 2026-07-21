using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using YiKe.Desktop.Models;
using YiKe.Desktop.Services;

namespace YiKe.Desktop.ViewModels;

public partial class DashboardViewModel : ObservableObject
{
    private int _spellSessionTotal;
    private int _recognizeSessionTotal;

    [ObservableProperty]
    private bool _isLoading;

    [ObservableProperty]
    private string _errorMessage = string.Empty;

    [ObservableProperty]
    private string _toastMessage = string.Empty;

    [ObservableProperty]
    private string _activeTrack = WordReviewTrack.Spell;

    [ObservableProperty]
    private ReviewWord? _currentWord;

    [ObservableProperty]
    private bool _meaningRevealed;

    [ObservableProperty]
    private string _spellInput = string.Empty;

    [ObservableProperty]
    private bool _spellHasError;

    [ObservableProperty]
    private string _spellErrorMessage = string.Empty;

    [ObservableProperty]
    private int _progressStep;

    [ObservableProperty]
    private int _progressTotal;

    public ObservableCollection<ReviewWord> SpellQueue { get; } = [];
    public ObservableCollection<ReviewWord> RecognizeQueue { get; } = [];

    public int SpellCount => SpellQueue.Count;
    public int RecognizeCount => RecognizeQueue.Count;

    public bool IsSpellTab => ActiveTrack == WordReviewTrack.Spell;
    public bool IsRecognizeTab => ActiveTrack == WordReviewTrack.Recognize;

    public bool HasActiveReview =>
        ActiveTrack == WordReviewTrack.Spell ? SpellCount > 0 : RecognizeCount > 0;

    public string EmptyStateText =>
        ActiveTrack == WordReviewTrack.Spell
            ? "今天没有待复习的单词卡片（拼写）"
            : "今天没有待复习的单词卡片（认知）";

    partial void OnActiveTrackChanged(string value)
    {
        UpdateCurrentWord();
        UpdateProgress();
        OnPropertyChanged(nameof(IsSpellTab));
        OnPropertyChanged(nameof(IsRecognizeTab));
        OnPropertyChanged(nameof(HasActiveReview));
        OnPropertyChanged(nameof(EmptyStateText));
    }

    [RelayCommand]
    public async Task LoadAsync()
    {
        IsLoading = true;
        ErrorMessage = string.Empty;
        try
        {
            var spell = await App.Api.GetTodayWordsAsync(WordReviewTrack.Spell);
            var recognize = await App.Api.GetTodayWordsAsync(WordReviewTrack.Recognize);

            SpellQueue.Clear();
            RecognizeQueue.Clear();
            foreach (var word in Shuffle(spell))
            {
                SpellQueue.Add(word);
            }

            foreach (var word in Shuffle(recognize))
            {
                RecognizeQueue.Add(word);
            }

            _spellSessionTotal = SpellQueue.Count;
            _recognizeSessionTotal = RecognizeQueue.Count;

            OpenWordReviewTab();
            ResetReviewCardState();
            UpdateCurrentWord();
            UpdateProgress();
            NotifyCounts();
        }
        catch (UnauthorizedAccessException)
        {
            App.Auth.Clear();
        }
        catch (Exception ex)
        {
            ErrorMessage = ex.Message;
        }
        finally
        {
            IsLoading = false;
        }
    }

    [RelayCommand]
    public void SelectSpellTab()
    {
        ActiveTrack = WordReviewTrack.Spell;
    }

    [RelayCommand]
    public void SelectRecognizeTab()
    {
        ActiveTrack = WordReviewTrack.Recognize;
    }

    [RelayCommand]
    public void OpenWordReviewTab()
    {
        if (SpellCount > 0)
        {
            ActiveTrack = WordReviewTrack.Spell;
        }
        else if (RecognizeCount > 0)
        {
            ActiveTrack = WordReviewTrack.Recognize;
        }
        else
        {
            ActiveTrack = WordReviewTrack.Spell;
        }
    }

    [RelayCommand]
    public async Task SubmitSpellAsync()
    {
        if (CurrentWord == null || !IsSpellTab)
        {
            return;
        }

        var expected = CurrentWord.Word.Trim();
        var actual = SpellInput.Trim();
        if (!string.Equals(expected, actual, StringComparison.OrdinalIgnoreCase))
        {
            SpellHasError = true;
            SpellErrorMessage = "拼写不正确，请再试一次";
            return;
        }

        await CompleteSpellReviewAsync(peeked: false);
    }

    [RelayCommand]
    public async Task PeekSpellAnswerAsync()
    {
        if (CurrentWord == null || !IsSpellTab)
        {
            return;
        }

        await CompleteSpellReviewAsync(peeked: true);
    }

    [RelayCommand]
    public void RevealMeaning()
    {
        if (CurrentWord != null && IsRecognizeTab)
        {
            MeaningRevealed = true;
        }
    }

    [RelayCommand]
    public async Task RecognizeKnownAsync()
    {
        if (CurrentWord == null || !IsRecognizeTab || !MeaningRevealed)
        {
            return;
        }

        var word = CurrentWord;
        try
        {
            await App.Api.ReviewWordAsync(word.Id, WordReviewTrack.Recognize);
            ToastMessage = $"{word.Word} 认知已复习";
            RemoveFromRecognizeQueue(word.Id);
        }
        catch (Exception ex)
        {
            ErrorMessage = ex.Message;
        }
    }

    [RelayCommand]
    public void RecognizeForgot()
    {
        if (CurrentWord == null || !IsRecognizeTab || !MeaningRevealed || RecognizeQueue.Count <= 1)
        {
            return;
        }

        var current = RecognizeQueue[0];
        RecognizeQueue.RemoveAt(0);
        RecognizeQueue.Add(current);
        ResetReviewCardState();
        UpdateCurrentWord();
        UpdateProgress();
        NotifyCounts();
    }

    [RelayCommand]
    public async Task SkipCurrentAsync()
    {
        if (CurrentWord == null)
        {
            return;
        }

        var word = CurrentWord;
        var track = ActiveTrack;
        try
        {
            await App.Api.SkipWordAsync(word.Id, track);
            if (track == WordReviewTrack.Spell)
            {
                RemoveFromSpellQueue(word.Id);
            }
            else
            {
                RemoveFromRecognizeQueue(word.Id);
            }
        }
        catch (Exception ex)
        {
            ErrorMessage = ex.Message;
        }
    }

    private async Task CompleteSpellReviewAsync(bool peeked)
    {
        if (CurrentWord == null)
        {
            return;
        }

        var word = CurrentWord;
        try
        {
            if (!peeked)
            {
                await App.Api.ReviewWordAsync(word.Id, WordReviewTrack.Spell);
                ToastMessage = $"{word.Word} 拼写已复习";
            }

            RemoveFromSpellQueue(word.Id);
        }
        catch (Exception ex)
        {
            ErrorMessage = ex.Message;
        }
    }

    private void RemoveFromSpellQueue(int id)
    {
        for (var i = SpellQueue.Count - 1; i >= 0; i--)
        {
            if (SpellQueue[i].Id == id)
            {
                SpellQueue.RemoveAt(i);
            }
        }

        ResetReviewCardState();
        UpdateCurrentWord();
        UpdateProgress();
        NotifyCounts();
    }

    private void RemoveFromRecognizeQueue(int id)
    {
        for (var i = RecognizeQueue.Count - 1; i >= 0; i--)
        {
            if (RecognizeQueue[i].Id == id)
            {
                RecognizeQueue.RemoveAt(i);
            }
        }

        ResetReviewCardState();
        UpdateCurrentWord();
        UpdateProgress();
        NotifyCounts();
    }

    private void ResetReviewCardState()
    {
        MeaningRevealed = false;
        SpellInput = string.Empty;
        SpellHasError = false;
        SpellErrorMessage = string.Empty;
    }

    private void UpdateCurrentWord()
    {
        CurrentWord = ActiveTrack == WordReviewTrack.Spell
            ? SpellQueue.FirstOrDefault()
            : RecognizeQueue.FirstOrDefault();
    }

    private void UpdateProgress()
    {
        var total = ActiveTrack == WordReviewTrack.Spell
            ? Math.Max(_spellSessionTotal, SpellCount)
            : Math.Max(_recognizeSessionTotal, RecognizeCount);
        var remaining = ActiveTrack == WordReviewTrack.Spell ? SpellCount : RecognizeCount;
        ProgressTotal = total;
        ProgressStep = total - remaining + (remaining > 0 ? 1 : 0);
    }

    private void NotifyCounts()
    {
        OnPropertyChanged(nameof(SpellCount));
        OnPropertyChanged(nameof(RecognizeCount));
        OnPropertyChanged(nameof(HasActiveReview));
        OnPropertyChanged(nameof(EmptyStateText));
    }

    private static IReadOnlyList<ReviewWord> Shuffle(IReadOnlyList<ReviewWord> words)
    {
        var list = words.ToList();
        var rng = Random.Shared;
        for (var i = list.Count - 1; i > 0; i--)
        {
            var j = rng.Next(i + 1);
            (list[i], list[j]) = (list[j], list[i]);
        }

        return list;
    }
}
