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

const TranslationWizard = require('./app/bible_browser/translation_wizard.js');
const TranslationController = require('./app/bible_browser/translation_controller.js');
const BookSearch = require('./app/bible_browser/book_search.js');
const TabController = require('./app/bible_browser/tab_controller.js');
const NavigationPane = require('./app/bible_browser/navigation_pane.js');
const TextLoader = require('./app/bible_browser/text_loader.js');
const TaggedVerseExport = require('./app/bible_browser/tagged_verse_export.js');
const BibleBrowserCommunicationController = require('./app/bible_browser/bible_browser_communication_controller.js');

function sleep(time)
{
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, time);
  });
}

function BibleBrowserController() {
  this.book_menu_is_opened = false;
  this.tag_menu_is_opened = false;
  this.display_menu_is_opened = false;
  this.current_cr_verse_id = null;
  this.communication_controller = new BibleBrowserCommunicationController();
  this.tag_menu_populated = false;

  this.get_book_short_title = function(book_long_title) {
    for (var i = 0; i < bible_books.length; i++) {
      var current_book = bible_books[i];
      if (current_book.long_title == book_long_title) {
        return current_book.short_title;
      }
    }

    return -1;
  };

  this.get_book_long_title = function(book_short_title) {
    for (var i = 0; i < bible_books.length; i++) {
      var current_book = bible_books[i];
      if (current_book.short_title == book_short_title) {
        return current_book.long_title;
      }
    }

    return -1;
  };

  this.init = async function(settings) {
    this.verse_list_menu_template = $($('.verse-list-menu')[0]).html();
    this.verse_list_composite_template = $($('.verse-list-composite')[0]).html();

    this.settings = settings;

    this.translation_controller = new TranslationController();
    this.translation_controller.init(bible_browser_controller.onBibleTranslationChanged);
    this.translation_wizard = new TranslationWizard();

    this.text_loader = new TextLoader();

    this.book_search = new BookSearch();
    this.book_search.init('#book-search',
                          '#book-search-input',
                          '#book-search-occurances',
                          '#book-search-previous',
                          '#book-search-next',
                          bible_browser_controller.onSearchResultsAvailable,
                          bible_browser_controller.onSearchReset);

    var tabHtmlTemplate = bible_browser_controller.getTabHtmlTemplate();

    var bibleTranslations = await models.BibleTranslation.findAndCountAll();
    var defaultBibleTranslationId = null;
    if (bibleTranslations.rows.length > 0) {
      var defaultBibleTranslationId = bibleTranslations.rows[0].id;
    }

    this.tab_controller = new TabController();
    this.tab_controller.init('verse-list-tabs',
                             'verse-list-container',
                             tabHtmlTemplate,
                             bible_browser_controller.onTabSelected,
                             bible_browser_controller.onTabAdded,
                             defaultBibleTranslationId);

    this.navigation_pane = new NavigationPane();

    this.taggedVerseExport = new TaggedVerseExport();

    this.init_book_selection_menu();
    this.init_current_verse_list_menu();
    this.init_tag_selection_menu();
    // Not used
    //this.init_display_options_menu();
    this.init_tag_reference_box();
    this.init_bible_translation_info_box();
  };

  this.onSearchResultsAvailable = function(occurances) {
    for (var i = 0; i < occurances.length; i++) {
      var currentOccurance = $(occurances[i]);
      var verseBox = currentOccurance.closest('.verse-box');

      var currentBook = bible_browser_controller.tab_controller.getCurrentTabBook();
      var currentTagIdList = bible_browser_controller.tab_controller.getCurrentTagIdList();

      if (currentBook != null) {

        var verseReferenceContent = verseBox.find('.verse-reference-content').text();
        var chapter = bible_browser_controller.getChapterFromReference(verseReferenceContent);
        bible_browser_controller.navigation_pane.highlightSearchResult(chapter);

      } else if (currentTagIdList != null) {

        var book = verseBox.find('.verse-bible-book-short').text();
        var bibleBookLongTitle = bible_browser_controller.get_book_long_title(book);
        
        var bibleBookNumber = bible_browser_controller.getTaggedVerseListBookNumber(bibleBookLongTitle);
        if (bibleBookNumber != -1) {
          bible_browser_controller.navigation_pane.highlightSearchResult(bibleBookNumber);
        }
      }

    }
  };

  this.onSearchReset = function() {
    bible_browser_controller.navigation_pane.clearHighlightedSearchResults();
  };

  this.onTabSelected = async function(event, ui) {
    // Refresh tags view
    tags_controller.clear_verse_selection();

    var currentTabBook = bible_browser_controller.tab_controller.getCurrentTabBook(ui.index);
    if (currentTabBook != undefined && currentTabBook != null) {
      setTimeout(() => {
        tags_controller.communication_controller.request_tags(currentTabBook);
      }, 200);
    }

    // Refresh tags selection menu (It's global!)
    var currentTagTitleList = bible_browser_controller.tab_controller.getCurrentTagTitleList(ui.index);
    if (currentTagTitleList != "" && currentTagTitleList != null) {
        bible_browser_controller.communication_controller.request_tags_for_menu();
    }

    // Re-configure book search for current verse list
    var currentVerseList = bible_browser_controller.getCurrentVerseList(ui.index);
    bible_browser_controller.book_search.setVerseList(currentVerseList);

    // Re-configure bible translations menu for current verse list
    await bible_browser_controller.translation_controller.initTranslationsMenu();

    // Toggle book statistics
    bible_browser_controller.toggle_book_tags_statistics_button(ui.index);
  };

  this.onTabAdded = function() {
    resize_app_container();
    bible_browser_controller.init_tag_selection_menu();
    bible_browser_controller.init_current_verse_list_menu();
    bible_browser_controller.translation_controller.initBibleTranslationInfoButton();

    var currentBibleTranslationId = bible_browser_controller.tab_controller.getCurrentBibleTranslationId();
    if (currentBibleTranslationId != null) {
      bible_browser_controller.enableCurrentTranslationInfoButton();
    }
  };

  this.onBibleTranslationChanged = function() {
    var currentBook = bible_browser_controller.tab_controller.getCurrentTabBook();
    var currentTagIdList = bible_browser_controller.tab_controller.getCurrentTagIdList();
    var currentTabId = bible_browser_controller.tab_controller.getSelectedTabId();

    if (!bible_browser_controller.tab_controller.isCurrentTabEmpty()) {
      bible_browser_controller.text_loader.requestTextUpdate(currentTabId, currentBook, currentTagIdList, false);
    }
  };

  this.getTabHtmlTemplate = function() {
    var tabHtmlTemplate = "";

    tabHtmlTemplate += "<div class='verse-list-menu'>";
    tabHtmlTemplate += bible_browser_controller.verse_list_menu_template;
    tabHtmlTemplate += "</div>";

    tabHtmlTemplate += "<div class='verse-list-composite'>";
    tabHtmlTemplate += bible_browser_controller.verse_list_composite_template;
    tabHtmlTemplate += "</div>";

    return tabHtmlTemplate;
  };

  this.loadSettings = async function() {
    await bible_browser_controller.translation_controller.loadSettings();

    if (bible_browser_controller.settings.has('selected_book') &&
        bible_browser_controller.settings.get('selected_book') != null &&
        bible_browser_controller.translation_controller.bibleTranslationCount > 0) {

      bible_browser_controller.select_bible_book(bible_browser_controller.settings.get('selected_book.code'),
                                                 bible_browser_controller.settings.get('selected_book.name'));
    }

    if (bible_browser_controller.settings.has('selected_tags') &&
        bible_browser_controller.settings.get('selected_tags') != null) {

      currentTagIdList = bible_browser_controller.settings.get('selected_tags.id_list');
      currentTagTitleList = bible_browser_controller.settings.get('selected_tags.title_list');
      bible_browser_controller.tab_controller.setCurrentTagIdList(currentTagIdList);
      bible_browser_controller.tab_controller.setCurrentTagTitleList(currentTagTitleList);

      bible_browser_controller.get_tagged_verses();
    }

    if (bible_browser_controller.settings.get('tag_list_width') &&
        bible_browser_controller.settings.get('tag_list_width') != null) {

      $('#bible-browser-toolbox').css('width', bible_browser_controller.settings.get('tag_list_width'));
    }
  };

  this.init_book_selection_menu = function() {
    var menu = $('#app-container').find('#book-selection-menu');
    var links = menu.find('a');

    menu.bind('click', bible_browser_controller.handle_body_click);

    for (var i = 0; i < links.length; i++) {
      var current_link = $(links[i]);
      var current_link_href = current_link.attr('href');
      var current_book_title = current_link.html();
      var new_link_href = "javascript:bible_browser_controller.select_bible_book('" + 
                          current_link_href + "','" + current_book_title + "')";

      current_link.attr('href', new_link_href);
    }
  };

  this.init_current_verse_list_menu = function() {
    var currentVerseListMenu = bible_browser_controller.getCurrentVerseListMenu();
    var bookSelectButton = currentVerseListMenu.find('.book-select-button');
    bookSelectButton.bind('click', bible_browser_controller.handle_book_menu_click);
    $('.verse-list-menu').find('.fg-button').removeClass('events-configured');
    configure_button_styles('.verse-list-menu');
    bible_browser_controller.navigation_pane.updateNavigation();
    bible_browser_controller.translation_controller.initTranslationsMenu();
  };

  this.init_tag_selection_menu = function() {
    var currentVerseListMenu = bible_browser_controller.getCurrentVerseListMenu();
    currentVerseListMenu.find('.tag-select-button').bind('click', bible_browser_controller.handle_tag_menu_click);
    $('#tag-selection-filter-input').bind('keyup', bible_browser_controller.handle_tag_search_input);
  };

  // Not used
  this.init_display_options_menu = function() {
    $('#app-container').find('.display-options-button').bind('click', bible_browser_controller.handle_display_menu_click);
  };

  this.init_tag_reference_box = function() {
    $('#tag-reference-box').dialog({
      width: 620,
      position: [200,200],
      autoOpen: false,
      dialogClass: 'ezra-dialog'
    });
  };

  this.init_bible_translation_info_box = function() {
    $('#bible-translation-info-box').dialog({
      width: 800,
      height: 500,
      autoOpen: false,
      dialogClass: 'ezra-dialog'
    });
  };

  this.handle_tag_search_input = function(e) {
    clearTimeout(bible_browser_controller.tag_search_timeout);
    var search_value = $(this).val();

    bible_browser_controller.tag_search_timeout = setTimeout(function filter_tag_list() {
      //console.time('filter-tag-list');
      var labels = $('#tag-selection-taglist-global').find('.tag-browser-tag-title-content');
      $('#tag-selection-taglist-global').find('.tag-browser-tag').hide();

      for (var i = 0; i < labels.length; i++) {
        var current_label = $(labels[i]);

        if (current_label.text().toLowerCase().indexOf(search_value.toLowerCase()) != -1) {
          var current_tag_box = current_label.closest('.tag-browser-tag');
          current_tag_box.show();
        }
      }
      //console.timeEnd('filter-tag-list');
    }, 300);
  };

  this.getCurrentVerseListTabs = function(tabIndex=undefined) {
    var selectedTabId = bible_browser_controller.tab_controller.getSelectedTabId(tabIndex);
    var currentVerseListTabs = $('#' + selectedTabId);
    return currentVerseListTabs;
  }

  this.getCurrentVerseListMenu = function() {
    var currentVerseListTabs = bible_browser_controller.getCurrentVerseListTabs();
    var currentVerseListMenu = currentVerseListTabs.find('.verse-list-menu');
    return currentVerseListMenu;
  };

  this.getCurrentVerseListComposite = function(tabIndex=undefined) {
    var currentVerseListTabs = bible_browser_controller.getCurrentVerseListTabs(tabIndex);
    var currentVerseListComposite = currentVerseListTabs.find('.verse-list-composite');
    return currentVerseListComposite;
  };

  this.getCurrentVerseListFrame = function(tabIndex=undefined) {
    var currentVerseListComposite = bible_browser_controller.getCurrentVerseListComposite(tabIndex);
    var currentVerseListFrame = currentVerseListComposite.find('.verse-list-frame');
    return currentVerseListFrame;
  };

  this.getCurrentVerseList = function(tabIndex=undefined) {
    var currentVerseListFrame = bible_browser_controller.getCurrentVerseListFrame(tabIndex);
    var verseList = currentVerseListFrame.find('.verse-list');
    return verseList;
  };

  this.select_bible_book = function(book_code, book_title) {
    var currentBibleTranslationId = bible_browser_controller.tab_controller.getCurrentBibleTranslationId();
    models.BibleTranslation.getBookList(currentBibleTranslationId).then(books => {
      if (!books.includes(book_code)) {
        return;
      }

      bible_browser_controller.hide_book_menu();
      bible_browser_controller.hide_tag_menu();

      // Not needed at the moment
      //$('#outline-content').empty();

      bible_browser_controller.settings.set('selected_book', {
          code: book_code,
          name: book_title
      });

      // Set selected tags to null, since we just switched to a book
      bible_browser_controller.settings.set('selected_tags', null);
      bible_browser_controller.tab_controller.setCurrentTabBook(book_code, book_title);

      var currentVerseList = bible_browser_controller.getCurrentVerseList();
      bible_browser_controller.book_search.setVerseList(currentVerseList);

      var currentTabId = bible_browser_controller.tab_controller.getSelectedTabId();
      var currentBook = bible_browser_controller.tab_controller.getCurrentTabBook();

      bible_browser_controller.text_loader.requestTextUpdate(currentTabId, currentBook, null, true);
      tags_controller.communication_controller.request_tags();
    });
  };

  this.getCurrentVerseListLoadingIndicator = function() {
    var currentVerseListComposite = bible_browser_controller.getCurrentVerseListComposite();
    var loadingIndicator = currentVerseListComposite.find('.verse-list-loading-indicator');
    return loadingIndicator;
  };

  this.showVerseListLoadingIndicator = function() {
    var loadingIndicator = bible_browser_controller.getCurrentVerseListLoadingIndicator();
    loadingIndicator.find('.loader').show();
    loadingIndicator.show();
  };

  this.hideVerseListLoadingIndicator = function() {
    var loadingIndicator = bible_browser_controller.getCurrentVerseListLoadingIndicator();
    loadingIndicator.hide();
  };

  this.hide_book_menu = function() {
    if (bible_browser_controller.book_menu_is_opened) {
      $('#app-container').find('#book-selection-menu').hide();
      bible_browser_controller.book_menu_is_opened = false;

      var book_button = $('#app-container').find('.book-select-button');
      book_button.removeClass('ui-state-active');
    }
  };

  this.hide_tag_menu = function() {
    if (bible_browser_controller.tag_menu_is_opened) {
      $('#app-container').find('#tag-selection-menu').hide();
      bible_browser_controller.tag_menu_is_opened = false;

      var tag_button = $('#app-container').find('.tag-select-button');
      tag_button.removeClass('ui-state-active');
    }
  };

  this.hide_display_menu = function() {
    if (bible_browser_controller.display_menu_is_opened) {
      $('#app-container').find('#display-options-menu').hide();
      bible_browser_controller.display_menu_is_opened = false;

      var display_button = $('#app-container').find('.display-options-button');
      display_button.removeClass('ui-state-active');
    }
  };

  this.handle_body_click = function(event) {
    if($(this).hasClass('verse-selection-menu')) {
      event.stopPropagation();
      return;
    }
    
    bible_browser_controller.hide_book_menu();
    bible_browser_controller.hide_tag_menu();
    bible_browser_controller.hide_display_menu();

    if ($('#currently-edited-notes').length > 0) {
      notes_controller.restore_currently_edited_notes();
    }
  };

  this.handle_book_menu_click = function(event) {
    if ($('.book-select-button').hasClass('ui-state-disabled')) {
      return;
    }

    if (bible_browser_controller.book_menu_is_opened) {
      bible_browser_controller.handle_body_click();
    } else {
      bible_browser_controller.hide_tag_menu();
      bible_browser_controller.hide_display_menu();
      var currentVerseListMenu = bible_browser_controller.getCurrentVerseListMenu();
      var book_button = currentVerseListMenu.find('.book-select-button');
      book_button.addClass('ui-state-active');

      var book_button_offset = book_button.offset();
      var menu = $('#app-container').find('#book-selection-menu');
      var top_offset = book_button_offset.top + book_button.height() + 12;
      var left_offset = book_button_offset.left;

      menu.css('top', top_offset);
      menu.css('left', left_offset);

      $('#app-container').find('#book-selection-menu').slideDown();
      bible_browser_controller.book_menu_is_opened = true;
      event.stopPropagation();
    }
  };

  this.handle_tag_menu_click = function(event) {
    var currentVerseListMenu = bible_browser_controller.getCurrentVerseListMenu();
    var tagSelectButton = currentVerseListMenu.find('.tag-select-button');

    if (tagSelectButton.hasClass('ui-state-disabled')) {
      return;
    }

    if (bible_browser_controller.tag_menu_is_opened) {
      bible_browser_controller.handle_body_click();
    } else {
      bible_browser_controller.hide_book_menu();
      bible_browser_controller.hide_display_menu();
      tagSelectButton.addClass('ui-state-active');

      var tag_select_button_offset = tagSelectButton.offset();
      var menu = $('#app-container').find('#tag-selection-menu');
      var top_offset = tag_select_button_offset.top + tagSelectButton.height() + 12;
      var left_offset = tag_select_button_offset.left;

      menu.css('top', top_offset);
      menu.css('left', left_offset);

      if (!bible_browser_controller.tag_menu_populated) {
        bible_browser_controller.communication_controller.request_tags_for_menu();
        bible_browser_controller.tag_menu_populated = true;
      }

      $('#app-container').find('#tag-selection-menu').slideDown();
      bible_browser_controller.tag_menu_is_opened = true;
      event.stopPropagation();
    }
  };

  this.handle_display_menu_click = function(event) {
    if (bible_browser_controller.display_menu_is_opened) {
      bible_browser_controller.handle_body_click();
    } else {
      bible_browser_controller.hide_book_menu();
      bible_browser_controller.hide_tag_menu();
      var display_options_button = $('#app-container').find('.display-options-button');
      display_options_button.addClass('ui-state-active');

      var display_options_button_offset = display_options_button.offset();
      var menu = $('#app-container').find('#display-options-menu');
      var top_offset = display_options_button_offset.top + display_options_button.height() + 12;
      var left_offset = display_options_button_offset.left;

      menu.css('top', top_offset);
      menu.css('left', left_offset);

      $('#app-container').find('#display-options-menu').slideDown();
      bible_browser_controller.display_menu_is_opened = true;
      event.stopPropagation();
    }
  };

  this.bind_events_after_bible_text_loaded = async function() {
    $('.tag-box').filter(":not('.tag-events-configured')").bind('click', tags_controller.clear_verse_selection).addClass('tag-events-configured');
    $('.tag').filter(":not('.tag-events-configured')").bind('click', bible_browser_controller.handle_tag_reference_click).addClass('tag-events-configured');
    $('.verse-box').bind('mouseover', bible_browser_controller.onVerseBoxMouseOver);
  };

  this.getTaggedVerseListBookNumber = function(bibleBookLongTitle) {
    var bibleBookNumber = -1;
    var currentVerseListFrame = bible_browser_controller.getCurrentVerseListFrame();
    var bookHeaders = currentVerseListFrame.find('.tag-browser-verselist-book-header');

    for (var i = 0; i < bookHeaders.length; i++) {
      var currentBookHeader = $(bookHeaders[i]);
      var currentBookHeaderText = currentBookHeader.text();

      if (currentBookHeaderText == bibleBookLongTitle) {
        bibleBookNumber = i + 1;
        break;
      }
    }

    return bibleBookNumber;
  };

  this.onVerseBoxMouseOver = function() {
    var currentBook = bible_browser_controller.tab_controller.getCurrentTabBook();
    var currentTagIdList = bible_browser_controller.tab_controller.getCurrentTagIdList();

    if (currentBook != null) {

      var verseReferenceContent = $(this).find('.verse-reference-content').text();
      var mouseOverChapter = bible_browser_controller.getChapterFromReference(verseReferenceContent);
      bible_browser_controller.navigation_pane.highlightNavElement(mouseOverChapter);

    } else if (currentTagIdList != null) {

      var mouseOverBook = $(this).find('.verse-bible-book-short').text();
      var bibleBookLongTitle = bible_browser_controller.get_book_long_title(mouseOverBook);
      
      var bibleBookNumber = bible_browser_controller.getTaggedVerseListBookNumber(bibleBookLongTitle);
      if (bibleBookNumber != -1) {
        bible_browser_controller.navigation_pane.highlightNavElement(bibleBookNumber);
      }
    }
  };

  this.get_overlay_verse_box_position = function(verse_box) {
    var currentVerseListComposite = bible_browser_controller.getCurrentVerseListComposite();

    var verse_box_position = verse_box.offset();
    var verse_box_class = verse_box.attr('class');
    var verse_nr = parseInt(verse_box_class.match(/verse-nr-[0-9]*/)[0].split('-')[2]);
    var next_verse_nr = verse_nr + 1;

    var next_verse_box = currentVerseListComposite.find('.verse-nr-' + next_verse_nr);
    var next_verse_box_position = next_verse_box.offset();
    if (next_verse_box_position == undefined) {
      next_verse_box_position = verse_box.offset();
    }
    var verse_list_height = currentVerseListComposite.height();
    var verse_list_position = currentVerseListComposite.offset();
    var screen_bottom = verse_list_position.top + verse_list_height;
    var cross_reference_box_height = 240;
    var overlay_box_position = null;

    var appContainerWidth = $(window).width();
    var offsetLeft = appContainerWidth - 700;

    if ((next_verse_box_position.top + cross_reference_box_height) <
        screen_bottom) {
      // The box does fit in the screen space between the beginning
      // of the next verse box and the bottom of the screen
      overlay_box_position = {
        top: next_verse_box_position.top + 7,
        left: offsetLeft
      };
    } else {
      // The box does NOT fit in the screen space between the beginning
      // of the next verse box and the bottom of the screen
      overlay_box_position = {
        top: verse_box_position.top - cross_reference_box_height,
        left: offsetLeft
      };
    }

    return overlay_box_position;
  };

  this.handle_tag_reference_click = function() {
    var position = $(this).offset();
    var verse_box = $(this).closest('.verse-box');
    var verse_id = verse_box.find('.verse-id').text();
    var selected_tag = $(this).html().trim();
    selected_tag = selected_tag.replace(/&nbsp;/g, ' ');
    var tag_id = null;

    var tag_info_list = verse_box.find('.tag-global');
    for (var i = 0; i < tag_info_list.length; i++) {
      var current_tag_info = $(tag_info_list[i]);
      var current_tag_title = current_tag_info.find('.tag-title').text();

      if (current_tag_title == selected_tag) {
        tag_id = current_tag_info.find('.tag-id').text();
        break;
      }
    }

    var currentTabId = bible_browser_controller.tab_controller.getSelectedTabId();

    bible_browser_controller.communication_controller.request_verses_for_selected_tags(
      currentTabId,
      tag_id,
      bible_browser_controller.render_tagged_verse_list_in_reference_box,
      render_type='html',
      renderVerseMetaInfo=false
    );

    var box_position = bible_browser_controller.get_overlay_verse_box_position(verse_box);
    var title = gettext_strings.tagged_verses_for + ' "' + selected_tag + '"';

    $('#tag-reference-box').dialog({
      position: [box_position.left, box_position.top],
      title: title
    });
    $('#tag-reference-box-verse-list').empty();
    $('#tag-reference-box').dialog("open");
  };

  this.render_tagged_verse_list_in_reference_box = function(htmlVerses) {
    $('#tag-reference-box-verse-list').html(htmlVerses);
  };

  this.reset_tags_in_menu = function() {
    var taglist_container = $('#tag-selection-taglist-global');
    // Empty the container first, because there may be tags from previous calls
    taglist_container.empty();
  };

  this.render_tags_in_menu = function(tags) {
    bible_browser_controller.reset_tags_in_menu();
    var taglist_container = $('#tag-selection-taglist-global');
    bible_browser_controller.render_tag_list(tags, taglist_container, false);
    bind_click_to_checkbox_labels();
  };

  this.render_tag_list = function(tag_list, target_container, only_local) {
    while (target_container.firstChild) {
      target_container.removeChild(targetContainer.firstChild);
    }

    for (var i = 0; i < tag_list.length; i++) {
      var current_tag = tag_list[i];
      var current_tag_title = current_tag.title;
      var current_tag_id = current_tag.id;
      var current_book_id = current_tag.bibleBookId;
      var current_assignment_count = current_tag.globalAssignmentCount;

      if (only_local && (current_book_id == null)) {
        continue;
      }

      var current_tag_html = bible_browser_controller.get_html_for_tag(current_tag_id,
                                                                       current_tag_title,
                                                                       current_assignment_count);
      target_container.append(current_tag_html);
    }

    bible_browser_controller.bind_tag_cb_events();

    // Check all the previously selected tags in the list
    all_tags = target_container.find('.tag-browser-tag-title-content');
    for (var i = 0; i < all_tags.length; i++) {
      var current_tag = $(all_tags[i]);
      var current_tag_is_checked = bible_browser_controller.is_tag_selected(current_tag.text());

      if (current_tag_is_checked) {
        var tag_browser_tag = current_tag.closest('.tag-browser-tag');
        var tag_cb = tag_browser_tag.find('.tag-browser-tag-cb'); 
        tag_cb.attr('checked','checked');
      }
    }
  };

  this.is_tag_selected = function(tag_title) {
    var currentTagIdList = bible_browser_controller.tab_controller.getCurrentTagIdList();
    if (currentTagIdList != null) {
      var currentTagTitleList = bible_browser_controller.tab_controller.getCurrentTagTitleList();
      if (currentTagTitleList != null) {
        var tag_list = currentTagTitleList.split(', ');
        for (var i = 0; i < tag_list.length; i++) {
          var current_tag = tag_list[i];
          if (current_tag == tag_title) {
            return true;
          }
        }
      }
    }

    return false;
  };

  this.update_tag_title_in_selection = function(old_title, new_title) {
    var currentTagTitleList = bible_browser_controller.tab_controller.getCurrentTagTitleList();
    if (currentTagTitleList != null) {
      var tag_list = currentTagTitleList.split(', ');
      for (var i = 0; i < tag_list.length; i++) {
        var current_tag = tag_list[i];
        if (current_tag == old_title) {
          tag_list[i] = new_title;
          break;
        }
      }
      bible_browser_controller.tab_controller.setCurrentTagTitleList(tag_list.join(', '));
    }
  };

  this.bind_tag_cb_events = function() {
    var cbs = $('.tag-browser-tag-cb');

    cbs.bind('click', bible_browser_controller.handle_bible_tag_cb_click);
    cbs.removeAttr('checked');
    cbs.removeAttr('disabled');
  };

  this.handle_bible_tag_cb_click = function() {
    var currentTagIdList = bible_browser_controller.selected_tags();
    var currentTagTitleList = bible_browser_controller.selected_tag_titles();
    bible_browser_controller.tab_controller.setCurrentTagIdList(currentTagIdList);
    bible_browser_controller.tab_controller.setCurrentTagTitleList(currentTagTitleList);

    bible_browser_controller.settings.set('selected_tags', {
      id_list: currentTagIdList,
      title_list: currentTagTitleList
    });

    // Set selected book to null, since we just switched to selected tags
    bible_browser_controller.tab_controller.setCurrentTabBook(null, null);
    bible_browser_controller.settings.set('selected_book', null);

    bible_browser_controller.get_tagged_verses();
  };

  this.get_tagged_verses = function() {
    var currentTagIdList = bible_browser_controller.tab_controller.getCurrentTagIdList();
    var currentTabId = bible_browser_controller.tab_controller.getSelectedTabId();
    var currentVerseList = bible_browser_controller.getCurrentVerseList();

    bible_browser_controller.book_search.setVerseList(currentVerseList);

    if (currentTagIdList != "") {
      bible_browser_controller.text_loader.requestTextUpdate(currentTabId, null, currentTagIdList, true);

      tags_controller.communication_controller.request_tags();
      // PORTING DISABLED
      //tags_controller.communication_controller.request_meta_tags();
    }
  };

  this.selected_tags = function() {
    var checked_cbs = $('.tag-browser-tag-cb:checked');
    var tag_list = "";

    for (var i = 0; i < checked_cbs.length; i++) {
      var current_tag_id = $(checked_cbs[i]).closest('.tag-browser-tag').find('.tag-browser-tag-id').html();
      tag_list += current_tag_id;

      if (i < (checked_cbs.length - 1)) tag_list += ","
    }

    return tag_list;
  };

  this.get_html_for_tag = function(tag_id, tag_title, tag_assignment_count) {
    return "<div id='tag-browser-tag-" + tag_id + 
           "' class='tag-browser-tag'>" + 
           "<div class='tag-browser-tag-id'>" + tag_id + "</div>" +
           "<input class='tag-browser-tag-cb' type='checkbox'></input>" +
           "<div class='tag-browser-tag-title clickable-checkbox-label'>" +
           "<span class='tag-browser-tag-title-content'>" + tag_title + "</span>" +
           "<span class='tag-browser-tag-assignment-count'>(" + tag_assignment_count + ")</span>" +
           "</div>" +
           "</div>";
  };

  this.resetVerseListView = function() {
    var currentVerseList = bible_browser_controller.getCurrentVerseList()[0];
    if (currentVerseList != undefined) {
      while(currentVerseList.firstChild) {
        currentVerseList.removeChild(currentVerseList.firstChild);
      }
    }

    bible_browser_controller.navigation_pane.resetNavigationPane();
    $('.export-tagged-verses-button').hide();
  };

  this.selected_tag_titles = function() {
    var checked_cbs = $('.tag-browser-tag-cb:checked');
    var tag_list = "";

    for (var i = 0; i < checked_cbs.length; i++) {
      var current_tag_title = $(checked_cbs[i]).closest('.tag-browser-tag').find('.tag-browser-tag-title-content').text();
      tag_list += current_tag_title;

      if (i < (checked_cbs.length - 1)) tag_list += ", "
    }

    return tag_list;
  };

  this.update_verse_list_headline = function() {
    var selected_tags = bible_browser_controller.selected_tag_titles();

    $('#tag-browser-verselist-header-content').html(gettext_strings.bible_verses_tagged_with + ": " + selected_tags);
  };

  this.wrap_book_with_html = function(book_title) {
    return "<div class='tag-browser-verselist-book-header'>" + book_title + "</div>";
  };

  this.show_or_hide_verse_tags_based_on_option = function() {
    var currentVerseList = bible_browser_controller.getCurrentVerseList();
    if (bible_browser_controller.tags_switch_checked()) {
      currentVerseList.removeClass('verse-list-without-tags');
    } else {
      currentVerseList.addClass('verse-list-without-tags');
    }
  };

  this.show_or_hide_verse_notes_based_on_option = function() {
    var currentVerseList = bible_browser_controller.getCurrentVerseList();
    if (bible_browser_controller.verse_notes_switch_checked()) {
      currentVerseList.addClass('verse-list-with-notes');
    } else {
      if ($('#currently-edited-notes').length > 0) {
        // If the user wants to hide the notes the currently edited note
        // has to be restored as well
        notes_controller.restore_currently_edited_notes();
      }
      currentVerseList.removeClass('verse-list-with-notes');
    }
  };

  this.verse_notes_switch_checked = function() {
    return $('#verse-notes-switch').attr('checked');
  };

  this.tags_switch_checked = function() {
    return $('#tags-switch').attr('checked');
  };

  this.enable_toolbox = function() {
    $('#bible-browser-toolbox').find('.ui-tabs-nav').find('li').removeClass('ui-state-disabled');
  };

  this.enable_tagging_toolbox_only = function() {
    var menu_items = $('#bible-browser-toolbox').find('.ui-tabs-nav').find('li');
    for (var i = 0; i < menu_items.length; i++) {
      var current_item = $(menu_items[i]);
      if (current_item.find('a').attr('href') == '#tags-view') {
        current_item.removeClass('ui-state-disabled');
      } else {
        current_item.addClass('ui-state-disabled');
      }
    }
    $('#bible-browser-toolbox').tabs('select', 1);
  };

  this.disable_toolbox = function() {
    $('#bible-browser-toolbox').find('.ui-tabs-nav').find('li').addClass('ui-state-disabled');
  };

  this.init_application_for_current_verse_list = function() {
    // Disabled notes controller
    //notes_controller.init();
    tags_controller.init();
    bible_browser_controller.navigation_pane.updateNavigation();

    bible_browser_controller.bind_events_after_bible_text_loaded();
    bible_browser_controller.toggle_book_tags_statistics_button();
    tags_controller.bind_tag_events();
  };

  this.toggle_book_tags_statistics_button = async function(index=undefined) {
    var book_tag_statistics_button = $('#show-book-tag-statistics-button');
    if (index === undefined) {
      index = bible_browser_controller.tab_controller.getSelectedTabIndex();
    }

    if (bible_browser_controller.tab_controller.isCurrentTextBook(index)) {
      var tagsCount = await models.Tag.getTagCount();

      if (tagsCount > 0) {
        book_tag_statistics_button.removeClass('ui-state-disabled');
        book_tag_statistics_button.removeClass('events-configured');
      }

      book_tag_statistics_button.bind('click', function() {
        bible_browser_controller.open_book_tag_statistics(); 
      });
      book_tag_statistics_button.show();
    } else {
      book_tag_statistics_button.unbind()
      book_tag_statistics_button.addClass('ui-state-disabled');
      book_tag_statistics_button.addClass('events-configured');
    }

    configure_button_styles('.tags-header');
  };
  
  this.reset_tag_menu = function() {
    bible_browser_controller.tab_controller.setCurrentTagTitleList(null);
    bible_browser_controller.tab_controller.setCurrentTagIdList("");

    var taglist_container = $('#tag-selection-taglist-global');
    var tag_cb_list = taglist_container.find('.tag-browser-tag-cb');

    for (var i = 0; i < tag_cb_list.length; i++) {
      $(tag_cb_list[i]).removeAttr('checked');
    }
  };

  this.update_verse_count_in_tag_menu = function(tag_title, new_count) {
    var tag_list = $('.tag-browser-tag');

    for (var i = 0; i < tag_list.length; i++) {
      var current_tag = $(tag_list[i]).find('.tag-browser-tag-title-content').text();
      if (current_tag == tag_title) {
        $(tag_list[i]).find('.tag-browser-tag-assignment-count').text('(' + new_count + ')');
        break;
      }
    }
  };

  this.open_book_tag_statistics = function() {
    var currentVerseList = bible_browser_controller.getCurrentVerseList();
    var verse_list_position = currentVerseList.offset();
    var currentBook = bible_browser_controller.tab_controller.getCurrentTabBook();
    var currentBookName = bible_browser_controller.get_book_long_title(currentBook);

    $('#book-tag-statistics-box').dialog({
      position: [verse_list_position.left + 50, verse_list_position.top + 50],
      width: 350,
      title: currentBookName + ' - tag statistics'
    });
  };

  this.open_translation_settings_wizard = function() {
    bible_browser_controller.translation_wizard.openWizard();
  };

  this.getChapterFromReference = function(reference) {
    var chapter = Number(reference.split(reference_separator)[0]);
    return chapter;
  };

  this.getVerseFromReference = function(reference) {
    var verse = Number(reference.split(reference_separator)[1]);
    return verse;
  };

  this.jump_to_reference = function(reference, highlight) {
    var currentTabId = bible_browser_controller.tab_controller.getSelectedTabId();
    var chapter = bible_browser_controller.getChapterFromReference(reference);
    var verse = bible_browser_controller.getVerseFromReference(reference);

    var uniqueReference = '#' + currentTabId + ' ' + chapter + ':' + verse;

    if (chapter == 1 && verse < 5) {
      var currentVerseListComposite = bible_browser_controller.getCurrentVerseListComposite();
      currentVerseListComposite[0].scrollTop = 0;
    } else {
      window.location = uniqueReference;
    }

    bible_browser_controller.navigation_pane.highlightNavElement(chapter);

    /*if (highlight) { // FIXME
      original_verse_box.glow();
    }*/
  };

  this.enableTaggedVersesExportButton = function() {
    $('.export-tagged-verses-button').removeClass('ui-state-disabled');

    var export_button = $('.export-tagged-verses-button');
    export_button.unbind('click');
    export_button.bind('click', function() {
      bible_browser_controller.taggedVerseExport.runExport();
      
      /*var selected_tags = bible_browser_controller.selected_tags();
      var url = '/tags/' + selected_tags + '/tagged_verses.odt';
      location.href = url;*/
    });
    export_button.show();
    export_button.removeClass('events-configured');
    configure_button_styles('.verse-list-menu');
  }

  this.enableCurrentTranslationInfoButton = function() {
    var currentVerseListMenu = bible_browser_controller.getCurrentVerseListMenu();
    var translationInfoButton = currentVerseListMenu.find('.bible-translation-info-button');
    translationInfoButton.removeClass('ui-state-disabled');
  }

  this.disableCurrentTranslationInfoButton = function() {
    var currentVerseListMenu = bible_browser_controller.getCurrentVerseListMenu();
    var translationInfoButton = currentVerseListMenu.find('.bible-translation-info-button');
    translationInfoButton.addClass('ui-state-disabled');
  }
}
 
