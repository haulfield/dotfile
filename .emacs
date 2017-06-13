(custom-set-variables
 ;; custom-set-variables was added by Custom.
 ;; If you edit it by hand, you could mess it up, so be careful.
 ;; Your init file should contain only one such instance.
 ;; If there is more than one, they won't work right.
 '(ensime-default-scala-version "2.11.1")
 '(inhibit-startup-screen t)
 '(menu-bar-mode nil)
 '(scroll-bar-mode nil)
 '(server-mode t)
 '(sr-speedbar-right-side nil)
 '(tool-bar-mode nil))
(custom-set-faces
 ;; custom-set-faces was added by Custom.
 ;; If you edit it by hand, you could mess it up, so be careful.
 ;; Your init file should contain only one such instance.
 ;; If there is more than one, they won't work right.
 '(default ((t (:family "Monaco" :foundry "unknown" :slant normal :weight normal :height 101 :width normal)))))

(setq make-backup-files nil)
(setq auto-saze-list-filen-name nil)
(setq auto-save-default nil)

;; (add-to-list 'load-path "~/.emacs.d/")

(require 'package)
(package-initialize)
(add-to-list 'package-archives '("melpa" . "http://melpa.milkbox.net/packages/") t)
(add-to-list 'package-archives '("marmalade" . "http://marmalade-repo.org/packages/"))

;; line numbers
(global-linum-mode t)

;; ido-mode
(require 'ido)
(ido-mode t)
(setq ido-enable-flex-matching t)

(require 'color-theme)
(color-theme-solarized-light)

;; built-in
(require 'bs)
(setq bs-configurations
'(("files" "^\\*scratch\\*" nil nil bs-visits-non-file bs-sort-buffer-interns-are-last)))
;; buffer-show shortcut
(global-set-key (kbd "<f2>") 'bs-show)

;; autocomplete
(add-to-list 'load-path "~/.emacs.d/elpa/autocomplete")
(require 'auto-complete-config)
(ac-config-default)
(add-to-list 'ac-dictionary-directories "~/.emacs.d/elpa/autocomplete/dict")

;; speedbar
(require 'sr-speedbar)
(global-set-key (kbd "<f11>") 'sr-speedbar-toggle)

;; yasnippet
(require 'yasnippet)
(yas-global-mode 1)

(defun toggle-night-color-theme ()
  "Switch to/from night color scheme."
  (interactive)
  (require 'color-theme)
  (if (eq (frame-parameter (next-frame) 'background-mode) 'dark)
      (color-theme-snapshot) ; restore default (light) colors
    ;; create the snapshot if necessary
    (when (not (commandp 'color-theme-snapshot))
      (fset 'color-theme-snapshot (color-theme-make-snapshot)))
      (color-theme-solarized-dark)))

(global-set-key (kbd "<f9>") 'toggle-night-color-theme)

(defun toggle-fullscreen ()
  "Toggle full screen on X11"
  (interactive)
  (when (eq window-system 'x)
    (set-frame-parameter
     nil 'fullscreen
     (when (not (frame-parameter nil 'fullscreen)) 'fullboth))))

(global-set-key (kbd "<C-f11>") 'toggle-fullscreen)

;; multiple cursos
(require 'multiple-cursors)
(global-set-key (kbd "C->") 'mc/mark-next-like-this)
(global-set-key (kbd "C-<") 'mc/mark-previous-like-this)
(global-set-key (kbd "C-c C-<") 'mc/mark-all-like-this)

(set-frame-parameter (selected-frame) 'alpha '(60 60))
(add-to-list 'default-frame-alist '(alpha 60 60))
