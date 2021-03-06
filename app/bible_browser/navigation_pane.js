/* This file is part of Ezra Project.

   Copyright (C) 2019 Tobias Klein <contact@ezra-project.net>

   Ezra Project is free software: you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.

   Ezra Project is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with Ezra Project. See the file COPYING.
   If not, see <http://www.gnu.org/licenses/>. */

class NavigationPane {
  constructor() {
  }

  getCurrentNavigationPane() {
    var currentVerseListTabs = bible_browser_controller.getCurrentVerseListTabs();
    var navigationPane = currentVerseListTabs.find('.navigation-pane');
    return navigationPane;
  };

  initNavigationPaneForCurrentView() {
    var navigationPane = this.getCurrentNavigationPane();

    var currentBook = bible_browser_controller.tab_controller.getCurrentTabBook();
    var currentTagTitleList = bible_browser_controller.tab_controller.getCurrentTagTitleList();

    if (currentBook != null) { // Book text mode

      navigationPane.removeClass('navigation-pane-books');
      navigationPane.addClass('navigation-pane-chapters');

    } else if (currentTagTitleList != null) { // Tagged verse list mode

      navigationPane.removeClass('navigation-pane-chapters');
      navigationPane.addClass('navigation-pane-books');
    }
  }

  highlightNavElement(navElementNumber) {
    var navElementIndex = navElementNumber - 1;
    var currentNavigationPane = this.getCurrentNavigationPane();
    var allNavElementLinks = currentNavigationPane.find('.navigation-link');
    var lastHighlightedNavElementIndex = bible_browser_controller.tab_controller.getLastHighlightedNavElementIndex();

    if ((allNavElementLinks.length - 1) >= navElementIndex &&
        (allNavElementLinks.length - 1) >= lastHighlightedNavElementIndex) {

      var lastHighlightedNavElementLink = $(allNavElementLinks[lastHighlightedNavElementIndex]);
      var highlightedNavElementLink = $(allNavElementLinks[navElementIndex]);

      lastHighlightedNavElementLink.removeClass('hl-nav-element');
      highlightedNavElementLink.addClass('hl-nav-element');
    }

    bible_browser_controller.tab_controller.setLastHighlightedNavElementIndex(navElementIndex);
  }

  updateChapterNavigation() {
    var navigationPane = this.getCurrentNavigationPane();
    var currentBook = bible_browser_controller.tab_controller.getCurrentTabBook();
    var verse_counts = bible_chapter_verse_counts[currentBook];
    var i = 1;

    for (var key in verse_counts) {
      if (key == 'nil') {
        break;
      }

      var current_chapter_link = document.createElement('a');
      current_chapter_link.setAttribute('class', 'navigation-link');
      var href = 'javascript:bible_browser_controller.navigation_pane.goToChapter(' + i + ')';
      current_chapter_link.setAttribute('href', href);
      $(current_chapter_link).html(i);

      navigationPane.append(current_chapter_link);
      i++;
    }
  }

  updateBookNavigation() {
    var navigationPane = this.getCurrentNavigationPane();
    var currentVerseListFrame = bible_browser_controller.getCurrentVerseListFrame();
    var bookHeaders = currentVerseListFrame.find('.tag-browser-verselist-book-header');

    for (var i = 0; i < bookHeaders.length; i++) {
      var bookNumber = i + 1;
      var currentBookHeader = $(bookHeaders[i]);
      var currentBookHeaderText = currentBookHeader.text();
      var currentBook = bible_browser_controller.get_book_short_title(currentBookHeaderText);

      var currentBookLink = document.createElement('a');
      currentBookLink.setAttribute('class', 'navigation-link');
      var href = 'javascript:bible_browser_controller.navigation_pane.goToBook("' + currentBook + '",' + bookNumber + ')';
      currentBookLink.setAttribute('href', href);
      $(currentBookLink).html(currentBookHeaderText);

      navigationPane.append(currentBookLink);
    }
  }

  resetNavigationPane() {
    var navigationPane = this.getCurrentNavigationPane();
    navigationPane.children().remove();
  }

  updateNavigation() {
    this.resetNavigationPane();

    var currentBook = bible_browser_controller.tab_controller.getCurrentTabBook();
    var currentTagIdList = bible_browser_controller.tab_controller.getCurrentTagIdList();

    if (currentBook != null && bible_chapter_verse_counts != null) { // Update navigation based on book chapters

      this.updateChapterNavigation();

    } else if (currentTagIdList != null) { // Update navigation based on tagged verses books

      this.updateBookNavigation();
    }
  }

  goToChapter(chapter) {
    this.highlightNavElement(chapter);

    var currentTabId = bible_browser_controller.tab_controller.getSelectedTabId();
    var reference = '#top';

    if (chapter > 1) {
      reference = '#' + currentTabId + ' ' + chapter + ':1';
      window.location = reference;
    } else {
      var currentVerseListFrame = bible_browser_controller.getCurrentVerseListFrame();
      currentVerseListFrame[0].scrollTop = 0;
    }
  }

  goToBook(book, bookNr) {
    this.highlightNavElement(bookNr);

    var currentTabId = bible_browser_controller.tab_controller.getSelectedTabId();
    var reference = '#' + currentTabId + ' ' + book;
    window.location = reference;
  }

  highlightSearchResult(navElementNumber) {  
    var navElementIndex = navElementNumber - 1;
    var currentNavigationPane = this.getCurrentNavigationPane();
    var allNavElementLinks = currentNavigationPane.find('.navigation-link');

    var highlightedLink = $(allNavElementLinks[navElementIndex]);
    highlightedLink.addClass('hl-search-result');
  }

  clearHighlightedSearchResults() {
    var currentNavigationPane = this.getCurrentNavigationPane();
    var allHighlightedLinks = currentNavigationPane.find('.hl-search-result');

    for (var i=0; i < allHighlightedLinks.length; i++) {
      var currentLink = $(allHighlightedLinks[i]);
      currentLink.removeClass('hl-search-result');
    }
  }
}

module.exports = NavigationPane;

