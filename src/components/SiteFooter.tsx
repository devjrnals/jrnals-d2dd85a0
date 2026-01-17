import { useNavigate } from "react-router-dom";

export function SiteFooter() {
  const navigate = useNavigate();

  return (
    <footer className="text-gray-900">
      {/* Footer Links */}
      <div className="container px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-12">
          {/* Left Section - Brand and CTA */}
          <div className="md:col-span-1">
            <img src="/logo.png" alt="Jrnals" className="h-8 w-auto mb-2" loading="eager" />
            <p className="text-sm text-gray-600 mb-6">Context for Education</p>
            <p className="text-sm text-gray-600">Release will be available on desktop.</p>
          </div>

          {/* PRODUCT */}
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-4">PRODUCT</p>
            <ul className="space-y-3 text-sm text-gray-600">
              <li>
            <button
              type="button"
                  onClick={() => navigate("/release-notes")}
                  className="hover:text-gray-900 transition-colors"
                    >
                  RELEASE NOTES
                    </button>
                  </li>
                </ul>
              </div>

          {/* RESOURCES */}
              <div>
            <p className="text-sm font-semibold text-gray-900 mb-4">RESOURCES</p>
            <ul className="space-y-3 text-sm text-gray-600">
                  <li>
                    <button
                      type="button"
                  onClick={() => navigate("/privacy")}
                  className="hover:text-gray-900 transition-colors"
                    >
                  PRIVACY
                    </button>
                  </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => navigate("/terms")}
                  className="hover:text-gray-900 transition-colors"
                      >
                  TERMS OF SERVICE
                      </button>
                    </li>
                  </ul>
                </div>

          {/* COMPANY */}
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-4">COMPANY</p>
            <ul className="space-y-3 text-sm text-gray-600">
              <li>
                <button
                  type="button"
                  onClick={() => navigate("/careers")}
                  className="hover:text-gray-900 transition-colors"
                >
                  CAREERS
                </button>
              </li>
            </ul>
        </div>

          {/* CONNECT */}
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-4">CONNECT</p>
            <ul className="space-y-3 text-sm text-gray-600">
              <li>
              <a
                href="https://x.com/jrnalscom"
                target="_blank"
                rel="noopener noreferrer"
                  className="hover:text-gray-900 transition-colors"
                >
                  X
                </a>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/company/jrnals"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gray-900 transition-colors"
                >
                  LINKEDIN
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/jrnals.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gray-900 transition-colors"
                >
                  INSTAGRAM
                </a>
              </li>
            </ul>
          </div>
            </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row items-center justify-center gap-4">
          <p className="text-sm text-gray-600">COPYRIGHT © 2026</p>
        </div>
      </div>
    </footer>
  );
}







