using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Navigation;
using Windows.System;
using YiKe.Desktop.ViewModels;

namespace YiKe.Desktop.Views;

public sealed partial class DashboardPage : Page
{
    public ShellViewModel Shell { get; private set; } = null!;
    public DashboardViewModel ViewModel => Shell.Dashboard;

    public DashboardPage()
    {
        InitializeComponent();
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        Shell = e.Parameter as ShellViewModel ?? new ShellViewModel();
    }

    private async void Refresh_Click(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        await ViewModel.LoadCommand.ExecuteAsync(null);
    }

    private void Page_KeyDown(object sender, KeyRoutedEventArgs e)
    {
        if (ViewModel.CurrentWord == null)
        {
            return;
        }

        if (ViewModel.IsRecognizeTab)
        {
            if ((e.Key == VirtualKey.Enter || e.Key == VirtualKey.Space) && !ViewModel.MeaningRevealed)
            {
                ViewModel.RevealMeaningCommand.Execute(null);
                e.Handled = true;
                return;
            }

            if ((e.Key == VirtualKey.Enter || e.Key == VirtualKey.Space) && ViewModel.MeaningRevealed)
            {
                var focused = FocusManager.GetFocusedElement();
                if (focused == ForgotButton)
                {
                    ViewModel.RecognizeForgotCommand.Execute(null);
                }
                else
                {
                    ViewModel.RecognizeKnownCommand.Execute(null);
                }

                e.Handled = true;
                return;
            }

            if (e.Key == VirtualKey.Left || e.Key == VirtualKey.Right)
            {
                if (!ViewModel.MeaningRevealed)
                {
                    return;
                }

                if (e.Key == VirtualKey.Left)
                {
                    ForgotButton.Focus(FocusState.Programmatic);
                }
                else
                {
                    KnownButton.Focus(FocusState.Programmatic);
                }

                e.Handled = true;
            }
        }
    }

    private void SpellInput_KeyDown(object sender, KeyRoutedEventArgs e)
    {
        if (e.Key == VirtualKey.Enter)
        {
            ViewModel.SubmitSpellCommand.Execute(null);
            e.Handled = true;
        }
    }
}
