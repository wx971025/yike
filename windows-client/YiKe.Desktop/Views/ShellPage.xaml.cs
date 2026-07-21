using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using YiKe.Desktop.ViewModels;

namespace YiKe.Desktop.Views;

public sealed partial class ShellPage : Page
{
    public ShellViewModel ViewModel { get; private set; } = null!;

    public ShellPage()
    {
        InitializeComponent();
    }

    protected override async void OnNavigatedTo(NavigationEventArgs e)
    {
        base.OnNavigatedTo(e);
        ViewModel = e.Parameter as ShellViewModel ?? new ShellViewModel();
        ContentFrame.Navigate(typeof(DashboardPage), ViewModel);
        await ViewModel.Dashboard.LoadCommand.ExecuteAsync(null);
    }

    private void NavView_SelectionChanged(NavigationView sender, NavigationViewSelectionChangedEventArgs args)
    {
        if (args.SelectedItem is not NavigationViewItem item)
        {
            return;
        }

        var tag = item.Tag?.ToString();
        switch (tag)
        {
            case "dashboard":
                ContentFrame.Navigate(typeof(DashboardPage), ViewModel);
                break;
            case "words":
                ContentFrame.Navigate(typeof(PlaceholderPage), ("单词管理", "阶段 3 将实现"));
                break;
            case "settings":
                ContentFrame.Navigate(typeof(PlaceholderPage), ("设置", "后续版本提供"));
                break;
        }
    }

    private void Logout_Click(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        App.Auth.Clear();
    }
}
